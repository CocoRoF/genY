"""
ToolRegistry — indexes all available tools and provides search/retrieval.

Uses keyword-based search (word overlap + name/description bonus scoring)
to find relevant tools from the registry.

Design:
    - All tools are registered at startup via MCPLoader integration.
    - Each tool is stored as a ToolEntry with full schema information.
    - The registry is a singleton accessed via get_tool_registry().

Integration points:
    - MCPLoader calls register_mcp_tools() for each MCP server's tool list.
    - MCPLoader calls register_builtin_tools() for tools/ folder tools.
    - Agents call search() / get_tool_schema() / browse_categories() via
      the ToolSearch MCP server (implemented separately).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from logging import getLogger
from typing import Any, Dict, List, Optional

logger = getLogger(__name__)


# ---------------------------------------------------------------------------
# ToolEntry — unified tool descriptor stored in the registry
# ---------------------------------------------------------------------------

@dataclass
class ToolEntry:
    """A single tool registered in the ToolRegistry.

    Contains all metadata needed for search, schema retrieval,
    and display to agents.
    """
    name: str
    description: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)
    server_name: Optional[str] = None
    source: str = "unknown"  # "mcp", "builtin", "manual"
    tags: List[str] = field(default_factory=list)
    annotations: Optional[Dict[str, Any]] = None

    def to_search_result(self) -> Dict[str, Any]:
        """Compact representation returned by search."""
        result: Dict[str, Any] = {
            "name": self.name,
            "description": self.description,
            "server": self.server_name,
        }
        if self.tags:
            result["tags"] = self.tags
        return result

    def to_full_schema(self) -> Dict[str, Any]:
        """Full schema including parameters — used after search to get
        the complete tool definition needed for invocation."""
        schema: Dict[str, Any] = {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "server": self.server_name,
            "source": self.source,
        }
        if self.tags:
            schema["tags"] = self.tags
        if self.annotations:
            schema["annotations"] = self.annotations
        return schema


# ---------------------------------------------------------------------------
# ToolRegistry
# ---------------------------------------------------------------------------

class ToolRegistry:
    """Central registry for all available tools.

    Provides:
        - Registration: register_mcp_tools(), register_builtin_tools()
        - Search: search(query, top_k) → list[ToolEntry]
        - Lookup: get_tool_schema(name) → dict | None
        - Browse: browse_categories() → dict
        - Listing: list_all_tools() → list[str]
    """

    def __init__(self) -> None:
        # Primary storage: name → ToolEntry
        self._tools: Dict[str, ToolEntry] = {}
        self._initialized = False

    # ========================================================================
    # Registration
    # ========================================================================

    def register_mcp_tools(
        self,
        server_name: str,
        tools: List[Dict[str, Any]],
    ) -> int:
        """Register tools from an MCP server's tools/list response.

        Args:
            server_name: MCP server name (e.g. "filesystem", "github").
            tools: List of MCP tool dicts with name, description, inputSchema,
                   and optional annotations.

        Returns:
            Number of tools registered.
        """
        count = 0

        for tool_def in tools:
            name = tool_def.get("name", "")
            if not name:
                continue

            # Build ToolEntry
            entry = ToolEntry(
                name=name,
                description=tool_def.get("description", ""),
                parameters=tool_def.get("inputSchema", {}),
                server_name=server_name,
                source="mcp",
                annotations=tool_def.get("annotations"),
            )
            self._tools[name] = entry
            count += 1

        logger.info(
            f"ToolRegistry: registered {count} tools from MCP server '{server_name}'"
        )
        return count

    def register_builtin_tools(
        self,
        tools: List[Any],
    ) -> int:
        """Register built-in tools from the tools/ folder.

        Accepts BaseTool instances, ToolWrapper instances, or dicts with
        name/description/parameters.

        Args:
            tools: List of tool objects from tools/ folder.

        Returns:
            Number of tools registered.
        """
        count = 0

        for tool_obj in tools:
            name, description, parameters = self._extract_tool_info(tool_obj)
            if not name:
                continue

            entry = ToolEntry(
                name=name,
                description=description,
                parameters=parameters,
                server_name="_builtin_tools",
                source="builtin",
            )
            self._tools[name] = entry
            count += 1

        logger.info(f"ToolRegistry: registered {count} built-in tools")
        return count

    def register_tool(
        self,
        name: str,
        description: str = "",
        parameters: Optional[Dict[str, Any]] = None,
        server_name: Optional[str] = None,
        source: str = "manual",
        tags: Optional[List[str]] = None,
        annotations: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Register a single tool manually.

        Useful for adding tools that aren't loaded from MCP or tools/ folder.
        """
        entry = ToolEntry(
            name=name,
            description=description,
            parameters=parameters or {},
            server_name=server_name,
            source=source,
            tags=tags or [],
            annotations=annotations,
        )
        self._tools[name] = entry

    def finalize(self) -> None:
        """Mark registration as complete.

        Called after all tools have been registered (end of startup).
        Triggers any post-registration optimizations (e.g. auto-organize).
        """
        self._initialized = True
        tool_count = len(self._tools)
        logger.info(f"ToolRegistry: finalized with {tool_count} tools")

    # ========================================================================
    # Search & Retrieval
    # ========================================================================

    def search(
        self,
        query: str,
        top_k: int = 5,
        history: Optional[List[str]] = None,
    ) -> List[ToolEntry]:
        """Search for tools matching a natural-language query.

        Uses keyword-based scoring (word overlap + name/description bonus).

        Args:
            query: Natural language search query.
            top_k: Maximum number of results.
            history: Previously called tool names (for history-aware retrieval).

        Returns:
            List of matching ToolEntry objects, ranked by relevance.
        """
        if not self._tools:
            return []

        return self._keyword_search(query, top_k)

    def get_tool_schema(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """Get the full schema for a specific tool.

        Args:
            tool_name: Exact tool name.

        Returns:
            Full tool schema dict, or None if not found.
        """
        entry = self._tools.get(tool_name)
        if entry:
            return entry.to_full_schema()
        return None

    def get_tool_entry(self, tool_name: str) -> Optional[ToolEntry]:
        """Get the ToolEntry for a specific tool."""
        return self._tools.get(tool_name)

    def browse_categories(self) -> Dict[str, Any]:
        """Browse tools organized by server/source.

        Returns a tree structure grouping tools by their MCP server
        or source type.
        """
        # Group by server_name
        by_server: Dict[str, List[str]] = {}
        for name, entry in self._tools.items():
            server = entry.server_name or "_unknown"
            by_server.setdefault(server, []).append(name)

        # Sort tool lists
        for tools_list in by_server.values():
            tools_list.sort()

        return {
            "servers": {
                server: {"tools": tools, "tool_count": len(tools)}
                for server, tools in sorted(by_server.items())
            },
            "total_tools": len(self._tools),
        }

    def get_workflow(self, tool_name: str) -> List[str]:
        """Get the execution workflow chain for a tool.

        Returns:
            Ordered list of tool names in the workflow chain.
            Currently returns empty — workflow chain detection is not implemented.
        """
        return []

    def list_all_tools(self) -> List[str]:
        """List all registered tool names."""
        return sorted(self._tools.keys())

    def get_stats(self) -> Dict[str, Any]:
        """Return registry statistics."""
        by_source: Dict[str, int] = {}
        by_server: Dict[str, int] = {}
        for entry in self._tools.values():
            by_source[entry.source] = by_source.get(entry.source, 0) + 1
            server = entry.server_name or "_unknown"
            by_server[server] = by_server.get(server, 0) + 1

        return {
            "total_tools": len(self._tools),
            "by_source": by_source,
            "by_server": by_server,
            "initialized": self._initialized,
        }

    # ========================================================================
    # Filtering (for ToolPolicy integration)
    # ========================================================================

    def filter_by_servers(self, allowed_servers: List[str]) -> List[ToolEntry]:
        """Get tools from specific MCP servers only."""
        return [
            entry for entry in self._tools.values()
            if entry.server_name in allowed_servers
        ]

    def filter_by_names(self, tool_names: List[str]) -> List[ToolEntry]:
        """Get specific tools by name."""
        return [
            self._tools[name]
            for name in tool_names
            if name in self._tools
        ]

    # ========================================================================
    # Internal
    # ========================================================================

    def _keyword_search(self, query: str, top_k: int) -> List[ToolEntry]:
        """Simple keyword-based search fallback.

        Scores each tool based on keyword overlap between the query
        and the tool's name + description.
        """
        query_lower = query.lower()
        query_words = set(re.split(r'\W+', query_lower)) - {"", "a", "the", "to", "and", "or", "of"}

        scored: List[tuple[float, ToolEntry]] = []
        for entry in self._tools.values():
            text = f"{entry.name} {entry.description}".lower()
            text_words = set(re.split(r'\W+', text))

            # Score: number of matching words + bonus for name match
            matches = query_words & text_words
            score = len(matches)

            # Bonus for query words appearing in tool name
            name_lower = entry.name.lower()
            for w in query_words:
                if w in name_lower:
                    score += 2.0

            # Bonus for substring match in description
            if query_lower in text:
                score += 3.0

            if score > 0:
                scored.append((score, entry))

        # Sort by score descending, return top_k
        scored.sort(key=lambda x: x[0], reverse=True)
        return [entry for _, entry in scored[:top_k]]

    @staticmethod
    def _extract_tool_info(tool_obj: Any) -> tuple[str, str, Dict[str, Any]]:
        """Extract name, description, parameters from a tool object.

        Handles BaseTool, ToolWrapper, and dict formats.
        """
        # Dict format
        if isinstance(tool_obj, dict):
            return (
                tool_obj.get("name", ""),
                tool_obj.get("description", ""),
                tool_obj.get("parameters", {}),
            )

        # BaseTool / ToolWrapper (has .name, .description, .parameters)
        name = getattr(tool_obj, "name", "")
        if not name and hasattr(tool_obj, "__name__"):
            name = tool_obj.__name__

        description = getattr(tool_obj, "description", "")
        if not description and hasattr(tool_obj, "__doc__"):
            description = tool_obj.__doc__ or ""

        parameters = getattr(tool_obj, "parameters", {})
        if parameters is None:
            parameters = {}

        # If it has a to_dict() method, try that
        if not name and hasattr(tool_obj, "to_dict"):
            try:
                d = tool_obj.to_dict()
                return (
                    d.get("name", ""),
                    d.get("description", ""),
                    d.get("parameters", {}),
                )
            except Exception:
                pass

        return (name, description, parameters)

    @property
    def tool_count(self) -> int:
        return len(self._tools)

    @property
    def is_initialized(self) -> bool:
        return self._initialized

    def __repr__(self) -> str:
        return (
            f"ToolRegistry(tools={len(self._tools)}, "
            f"initialized={self._initialized})"
        )


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_tool_registry: Optional[ToolRegistry] = None


def get_tool_registry() -> ToolRegistry:
    """Get the singleton ToolRegistry instance.

    Creates a new instance on first call.
    """
    global _tool_registry
    if _tool_registry is None:
        _tool_registry = ToolRegistry()
    return _tool_registry


def reset_tool_registry() -> None:
    """Reset the singleton (for testing)."""
    global _tool_registry
    _tool_registry = None
