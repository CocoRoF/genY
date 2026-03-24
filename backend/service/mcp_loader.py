"""
MCP Loader

Automatically loads JSON configs from mcp/ folder to create global MCP
configurations available for all Claude Code sessions.

Python tools are managed by ToolLoader and exposed to Claude CLI
via the Proxy MCP server pattern.

Usage:
    from service.mcp_loader import MCPLoader, get_global_mcp_config

    # Initialize and load
    loader = MCPLoader()
    loader.load_all()

    # Get global MCP config
    config = get_global_mcp_config()

    # Build per-session MCP config with proxy
    session_config = build_session_mcp_config(
        global_config=config,
        allowed_tools=["geny_session_list", "web_search"],
        session_id="abc-123",
        backend_port=8000,
    )
"""
import json
import os
import re
import sys
from logging import getLogger
from pathlib import Path
from typing import Dict, List, Any, Optional

from service.claude_manager.models import (
    MCPConfig,
    MCPServerStdio,
    MCPServerHTTP,
    MCPServerSSE,
    MCPServerConfig
)

logger = getLogger(__name__)

# Global MCP config storage
_global_mcp_config: Optional[MCPConfig] = None
_builtin_mcp_config: Optional[MCPConfig] = None
_mcp_loader_instance: Optional["MCPLoader"] = None

# Project root path
PROJECT_ROOT = Path(__file__).parent.parent


def get_global_mcp_config() -> Optional[MCPConfig]:
    """
    Return global MCP config

    Returns:
        Loaded global MCP config or None
    """
    return _global_mcp_config


def get_builtin_mcp_config() -> Optional[MCPConfig]:
    """Return built-in MCP config (from mcp/built_in/ folder).

    Built-in MCP servers are always included in all sessions
    regardless of tool preset filtering.
    """
    return _builtin_mcp_config


def set_global_mcp_config(config: MCPConfig) -> None:
    """
    Set global MCP config

    Args:
        config: MCP config to set
    """
    global _global_mcp_config
    _global_mcp_config = config


def set_builtin_mcp_config(config: MCPConfig) -> None:
    """Set built-in MCP config."""
    global _builtin_mcp_config
    _builtin_mcp_config = config


def set_mcp_loader_instance(loader: "MCPLoader") -> None:
    """Store the MCPLoader singleton for reload access."""
    global _mcp_loader_instance
    _mcp_loader_instance = loader


def get_mcp_loader_instance() -> Optional["MCPLoader"]:
    """Return the MCPLoader singleton (or None if not initialized)."""
    return _mcp_loader_instance


def reload_builtin_mcp() -> None:
    """Reload built-in MCP configs (mcp/built_in/) with current env vars.

    Called when a config that affects built-in MCP servers changes
    (e.g. GitHub token updated via Settings).
    """
    if _mcp_loader_instance is None:
        logger.debug("MCPLoader not initialized yet — skipping built-in MCP reload")
        return
    _mcp_loader_instance.reload_builtins()


def build_proxy_mcp_server(
    category: str,
    allowed_tools: List[str],
    session_id: str,
    backend_port: int = 8000,
) -> MCPServerStdio:
    """Build a Proxy MCP server config for a session.

    The proxy server is a lightweight subprocess that:
    - Auto-discovers tool files from the specified category folder
    - Registers tool schemas (from Python tool modules)
    - Forwards execution requests to the main process via HTTP

    Args:
        category: 'builtin' or 'custom' — determines which folder to scan.
        allowed_tools: List of tool names to make available.
        session_id: Session ID for context.
        backend_port: Port of the FastAPI backend.

    Returns:
        MCPServerStdio config for the proxy server.
    """
    proxy_script = str(PROJECT_ROOT / "tools" / "_proxy_mcp_server.py")
    backend_url = f"http://localhost:{backend_port}"
    tools_arg = ",".join(allowed_tools) if allowed_tools else ""

    # Pass critical env vars for the proxy subprocess.
    # Claude Code merges these with the parent environment, so we only
    # need to ensure the subprocess can locate user-installed packages
    # (e.g. pip install --user in Docker dev mode) and the project root.
    env: Dict[str, str] = {}
    home = os.environ.get("HOME") or os.environ.get("USERPROFILE")
    if home:
        env["HOME"] = home
    pythonpath = os.environ.get("PYTHONPATH", "")
    # Always include project root so the proxy can find tools/ and service/
    project_root_str = str(PROJECT_ROOT)
    if project_root_str not in pythonpath:
        pythonpath = f"{project_root_str}{os.pathsep}{pythonpath}" if pythonpath else project_root_str
    env["PYTHONPATH"] = pythonpath

    return MCPServerStdio(
        command=sys.executable,
        args=[proxy_script, backend_url, session_id, category, tools_arg],
        env=env if env else None,
    )


def build_session_mcp_config(
    global_config: Optional[MCPConfig],
    allowed_builtin_tools: List[str],
    allowed_custom_tools: List[str],
    session_id: str,
    backend_port: int = 8000,
    allowed_mcp_servers: Optional[List[str]] = None,
    extra_mcp: Optional[MCPConfig] = None,
) -> MCPConfig:
    """Build the complete MCP config for a session.

    Combines:
    1. _builtin_tools: Proxy MCP server for built-in Python tools (always included)
    2. _custom_tools: Proxy MCP server for custom Python tools (if any allowed)
    3. Built-in MCP servers from mcp/built_in/ (always included, no filtering)
    4. Custom MCP servers from mcp/custom/ (filtered by preset)
    5. Extra per-session MCP servers

    Args:
        global_config: Global MCP config (custom MCP servers from mcp/custom/).
        allowed_builtin_tools: Built-in tool names (always registered).
        allowed_custom_tools: Custom tool names (preset-filtered).
        session_id: Session ID.
        backend_port: FastAPI backend port.
        allowed_mcp_servers: List of custom MCP server names to include.
                             None or ["*"] includes all.
        extra_mcp: Additional per-session MCP config.

    Returns:
        Complete MCPConfig for the session's .mcp.json.
    """
    servers: Dict[str, MCPServerConfig] = {}

    # 1. Add Proxy MCP server for built-in tools (always included if tools exist)
    if allowed_builtin_tools:
        servers["_builtin_tools"] = build_proxy_mcp_server(
            category="builtin",
            allowed_tools=allowed_builtin_tools,
            session_id=session_id,
            backend_port=backend_port,
        )

    # 2. Add Proxy MCP server for custom tools (only if allowed)
    if allowed_custom_tools:
        servers["_custom_tools"] = build_proxy_mcp_server(
            category="custom",
            allowed_tools=allowed_custom_tools,
            session_id=session_id,
            backend_port=backend_port,
        )

    # 3. Add built-in MCP servers (always included, bypass preset filter)
    builtin_config = get_builtin_mcp_config()
    if builtin_config and builtin_config.servers:
        for name, config in builtin_config.servers.items():
            servers[name] = config

    # 4. Add custom MCP servers (filtered by preset)
    if global_config and global_config.servers:
        for name, config in global_config.servers.items():
            # Skip internal proxy servers (starts with _)
            if name.startswith("_"):
                continue
            # Apply filter
            if allowed_mcp_servers is None or "*" in allowed_mcp_servers:
                servers[name] = config
            elif name in allowed_mcp_servers:
                servers[name] = config

    # 5. Merge extra per-session config
    if extra_mcp and extra_mcp.servers:
        for name, config in extra_mcp.servers.items():
            servers[name] = config

    return MCPConfig(servers=servers)


class MCPLoader:
    """
    Auto-loader for MCP configs (external MCP servers).

    Loads JSON files from mcp/ folder to create the global MCP configuration.
    Python tools are handled separately by ToolLoader + Proxy MCP pattern.
    """

    def __init__(
        self,
        mcp_dir: Optional[Path] = None,
        tools_dir: Optional[Path] = None
    ):
        """
        Args:
            mcp_dir: MCP JSON config folder path (default: project_root/mcp)
            tools_dir: Tools folder path (default: project_root/tools) — kept for compatibility
        """
        self.mcp_dir = mcp_dir or PROJECT_ROOT / "mcp"
        self.builtin_dir = self.mcp_dir / "built_in"
        self.custom_dir = self.mcp_dir / "custom"
        self.tools_dir = tools_dir or PROJECT_ROOT / "tools"
        self.servers: Dict[str, MCPServerConfig] = {}  # custom MCP servers
        self.builtin_servers: Dict[str, MCPServerConfig] = {}  # built-in MCP servers
        self.server_descriptions: Dict[str, str] = {}  # server_name → description
        self.builtin_server_names: set = set()  # names of built-in servers (always included)
        self.custom_server_names: set = set()  # names loaded from mcp/custom/
        self.tools: List[Any] = []  # Legacy — kept for get_tool_count() compatibility

    def load_all(self) -> MCPConfig:
        """
        Load all MCP configs: built-in + custom.

        Returns:
            Global MCP config (custom servers only).
        """
        logger.info("=" * 60)
        logger.info("🔌 MCP Loader: Starting...")

        # Register singleton for reload access
        set_mcp_loader_instance(self)

        # 1. Load built-in MCP configs (mcp/built_in/*.json — always included)
        self._load_builtin_configs()

        # 2. Load custom MCP configs (mcp/custom/*.json — preset-filtered)
        self._load_custom_configs()

        # 3. Create global configs
        config = MCPConfig(servers=self.servers)
        set_global_mcp_config(config)

        builtin_config = MCPConfig(servers=self.builtin_servers)
        set_builtin_mcp_config(builtin_config)

        logger.info(f"🔌 MCP Loader: {len(self.builtin_servers)} built-in + {len(self.custom_server_names)} custom MCP servers")
        logger.info("   ℹ️ Python tools managed by ToolLoader (Proxy MCP pattern)")
        logger.info("=" * 60)

        return config

    def reload_builtins(self) -> None:
        """Reload built-in MCP configs from mcp/built_in/.

        Called when a relevant config changes (e.g. GitHub token updated)
        so that environment variable expansions pick up the new values.
        """
        # Clear descriptions for built-in servers before reload
        for name in self.builtin_server_names:
            self.server_descriptions.pop(name, None)
        self.builtin_servers.clear()
        self.builtin_server_names.clear()
        self._load_builtin_configs()
        builtin_config = MCPConfig(servers=self.builtin_servers)
        set_builtin_mcp_config(builtin_config)
        logger.info(f"🔄 MCP Loader: Reloaded {len(self.builtin_servers)} built-in MCP servers")

    def _load_builtin_configs(self) -> None:
        """Load JSON config files from mcp/built_in/ folder.

        Built-in MCP servers are always included in every session
        regardless of tool preset filtering.
        """
        if not self.builtin_dir.exists():
            return

        json_files = list(self.builtin_dir.glob("*.json"))
        if not json_files:
            return

        logger.info(f"📁 Loading built-in MCP configs from: {self.builtin_dir}")

        for json_file in json_files:
            try:
                server_name = json_file.stem

                with open(json_file, 'r', encoding='utf-8') as f:
                    config_data = json.load(f)

                # Expand environment variables
                config_data = self._expand_env_vars(config_data)

                # Skip if required env vars were not resolved
                if self._has_unresolved_env(config_data):
                    logger.info(f"   ⏭️ {server_name}: skipped (missing env vars — configure in Settings)")
                    continue

                server_config = self._create_server_config(config_data)

                if server_config:
                    self.builtin_servers[server_name] = server_config
                    self.builtin_server_names.add(server_name)
                    desc = config_data.get('description', '')
                    if desc:
                        self.server_descriptions[server_name] = desc
                    logger.info(f"   ✅ [built-in] {server_name}: {desc[:50]}" + ("..." if len(desc) > 50 else ""))

            except json.JSONDecodeError as e:
                logger.warning(f"   ⚠️ Invalid JSON in built_in/{json_file.name}: {e}")
            except Exception as e:
                logger.warning(f"   ⚠️ Failed to load built_in/{json_file.name}: {e}")

    def _load_custom_configs(self) -> None:
        """Load JSON config files from mcp/custom/ folder.

        Custom MCP servers are user-added and subject to preset filtering.
        Servers with unresolved env vars are skipped with a log message.
        """
        if not self.custom_dir.exists():
            return

        json_files = list(self.custom_dir.glob("*.json"))
        if not json_files:
            return

        logger.info(f"📁 Loading custom MCP configs from: {self.custom_dir}")

        for json_file in json_files:
            try:
                server_name = json_file.stem

                with open(json_file, 'r', encoding='utf-8') as f:
                    config_data = json.load(f)

                # Expand environment variables
                config_data = self._expand_env_vars(config_data)

                # Skip if required env vars were not resolved
                if self._has_unresolved_env(config_data):
                    logger.info(f"   ⏭️ {server_name}: skipped (missing env vars)")
                    continue

                server_config = self._create_server_config(config_data)

                if server_config:
                    self.servers[server_name] = server_config
                    self.custom_server_names.add(server_name)
                    desc = config_data.get('description', '')
                    if desc:
                        self.server_descriptions[server_name] = desc
                    logger.info(f"   ✅ [custom] {server_name}: {desc[:50]}" + ("..." if len(desc) > 50 else ""))

            except json.JSONDecodeError as e:
                logger.warning(f"   ⚠️ Invalid JSON in custom/{json_file.name}: {e}")
            except Exception as e:
                logger.warning(f"   ⚠️ Failed to load custom/{json_file.name}: {e}")

    def _expand_env_vars(self, data: Any) -> Any:
        """
        Expand environment variables in config (${VAR} or ${VAR:-default} format)
        """
        if isinstance(data, str):
            # Find ${VAR} or ${VAR:-default} patterns
            pattern = r'\$\{([^}:]+)(?::-([^}]*))?\}'

            def replace_env(match):
                var_name = match.group(1)
                default = match.group(2)
                value = os.environ.get(var_name)
                if not value:  # None or empty string → treat as unset
                    if default is not None:
                        return default
                    return match.group(0)  # Keep original if env var not found
                return value

            return re.sub(pattern, replace_env, data)

        elif isinstance(data, dict):
            return {k: self._expand_env_vars(v) for k, v in data.items()}

        elif isinstance(data, list):
            return [self._expand_env_vars(item) for item in data]

        return data

    @staticmethod
    def _has_unresolved_env(data: Any) -> bool:
        """Check if any ${VAR} references remain unresolved."""
        if isinstance(data, str):
            return bool(re.search(r'\$\{[^}]+\}', data))
        elif isinstance(data, dict):
            return any(MCPLoader._has_unresolved_env(v) for v in data.values())
        elif isinstance(data, list):
            return any(MCPLoader._has_unresolved_env(item) for item in data)
        return False

    def _create_server_config(self, data: Dict[str, Any]) -> Optional[MCPServerConfig]:
        """Create MCP server config from JSON data"""
        server_type = data.get('type', 'stdio')

        if server_type == 'stdio':
            command = data.get('command')
            if not command:
                return None
            return MCPServerStdio(
                command=command,
                args=data.get('args', []),
                env=data.get('env')
            )

        elif server_type == 'http':
            url = data.get('url')
            if not url:
                return None
            return MCPServerHTTP(
                url=url,
                headers=data.get('headers')
            )

        elif server_type == 'sse':
            url = data.get('url')
            if not url:
                return None
            return MCPServerSSE(
                url=url,
                headers=data.get('headers')
            )

        return None

    def get_server_count(self) -> int:
        """Return number of loaded external MCP servers."""
        return len(self.servers)

    def get_tool_count(self) -> int:
        """Return number of loaded tools (from ToolLoader)."""
        try:
            from service.tool_loader import get_tool_loader
            loader = get_tool_loader()
            return len(loader.get_all_tools())
        except Exception:
            return 0

    def get_config(self) -> MCPConfig:
        """Return current MCP config (custom servers only)."""
        return MCPConfig(servers=self.servers)

    def get_external_server_names(self) -> List[str]:
        """Return names of all loaded custom MCP servers."""
        return [name for name in self.servers.keys() if not name.startswith("_")]


def merge_mcp_configs(base: Optional[MCPConfig], override: Optional[MCPConfig]) -> Optional[MCPConfig]:
    """
    Merge two MCP configs

    Override config takes precedence over base.

    Args:
        base: Base config (global)
        override: Override config (per-session)

    Returns:
        Merged config
    """
    if not base and not override:
        return None

    if not base:
        return override

    if not override:
        return base

    # Merge servers (override takes precedence)
    merged_servers = {**base.servers, **override.servers}

    return MCPConfig(servers=merged_servers)
