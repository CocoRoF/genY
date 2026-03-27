"""
Bootstrap Context File Loader

Automatically discovers and loads project context files from the working
directory, inspired by OpenClaw's resolveBootstrapContextFiles() pattern.

Files searched:
- AGENTS.md: Project guidelines for agents
- CLAUDE.md: Claude-specific instructions
- README.md: Project description (optional)
- .cursorrules / .windsurfrules etc.: AI instruction files
"""

from __future__ import annotations

from logging import getLogger
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = getLogger(__name__)

# List of files to auto-discover (in priority order)
DEFAULT_CONTEXT_FILES: List[Tuple[str, str, int]] = [
    # (filename, XML tag, max size in bytes)
    ("AGENTS.md", "project-context", 50_000),
    ("CLAUDE.md", "ai-instructions", 50_000),
    (".claude", "ai-instructions", 50_000),
    (".cursorrules", "ai-instructions", 30_000),
    (".windsurfrules", "ai-instructions", 30_000),
    ("SOUL.md", "persona", 20_000),
]

# README.md is included only on explicit request (may be large)
OPTIONAL_CONTEXT_FILES: List[Tuple[str, str, int]] = [
    ("README.md", "project-readme", 30_000),
    ("CONTRIBUTING.md", "project-contributing", 20_000),
]


class ContextLoader:
    """Project context file loader.

    Automatically discovers and loads project context files useful
    to the agent from the working directory.

    Usage:
        loader = ContextLoader(working_dir="/path/to/project")
        context_files = loader.load_context_files()
        # Returns: {"AGENTS.md": "file content...", "CLAUDE.md": "..."}
    """

    def __init__(
        self,
        working_dir: str,
        max_total_size: int = 100_000,
        include_readme: bool = False,
        custom_files: Optional[List[str]] = None,
    ):
        """
        Args:
            working_dir: Project working directory
            max_total_size: Maximum total size of all context files (bytes)
            include_readme: Whether to include README.md
            custom_files: List of additional file paths to load
        """
        self._working_dir = Path(working_dir)
        self._max_total_size = max_total_size
        self._include_readme = include_readme
        self._custom_files = custom_files or []

    def load_context_files(self) -> Dict[str, str]:
        """Automatically discovers and loads project context files.

        Returns:
            Dictionary of {filename: content}
        """
        result: Dict[str, str] = {}
        total_size = 0

        # 1. Discover default context files
        for filename, tag, max_size in DEFAULT_CONTEXT_FILES:
            content = self._try_load_file(filename, max_size)
            if content and (total_size + len(content)) <= self._max_total_size:
                result[filename] = content
                total_size += len(content)
                logger.info(f"Loaded context file: {filename} ({len(content)} chars)")

        # 2. Optional files (README.md etc.)
        if self._include_readme:
            for filename, tag, max_size in OPTIONAL_CONTEXT_FILES:
                content = self._try_load_file(filename, max_size)
                if content and (total_size + len(content)) <= self._max_total_size:
                    result[filename] = content
                    total_size += len(content)
                    logger.info(f"Loaded optional context file: {filename} ({len(content)} chars)")

        # 3. Custom files
        for filepath in self._custom_files:
            content = self._try_load_file(filepath, 50_000)
            if content and (total_size + len(content)) <= self._max_total_size:
                result[filepath] = content
                total_size += len(content)
                logger.info(f"Loaded custom context file: {filepath} ({len(content)} chars)")

        logger.info(
            f"ContextLoader: loaded {len(result)} files, "
            f"total {total_size} chars from {self._working_dir}"
        )

        return result

    def get_context_file_tags(self) -> Dict[str, str]:
        """Returns a mapping of filename to XML tag."""
        mapping = {}
        for filename, tag, _ in DEFAULT_CONTEXT_FILES + OPTIONAL_CONTEXT_FILES:
            mapping[filename] = tag
        return mapping

    def _try_load_file(self, filename: str, max_size: int) -> Optional[str]:
        """Safely loads a file. Returns None if it does not exist or exceeds the size limit."""
        filepath = self._working_dir / filename

        # Also search the parent directory (monorepo pattern)
        if not filepath.exists():
            parent = self._working_dir.parent / filename
            if parent.exists():
                filepath = parent
            else:
                return None

        try:
            # Check file size
            file_size = filepath.stat().st_size
            if file_size > max_size:
                logger.warning(
                    f"Context file too large, skipping: {filename} "
                    f"({file_size} > {max_size} bytes)"
                )
                return None
            if file_size == 0:
                return None

            # Read file
            content = filepath.read_text(encoding="utf-8")
            return content.strip()

        except (OSError, UnicodeDecodeError) as e:
            logger.warning(f"Failed to load context file {filename}: {e}")
            return None

    def list_available_files(self) -> List[Dict[str, str]]:
        """Returns a list of available context files (for debugging)."""
        available = []

        all_files = DEFAULT_CONTEXT_FILES + OPTIONAL_CONTEXT_FILES
        for filename, tag, max_size in all_files:
            filepath = self._working_dir / filename
            exists = filepath.exists()

            info = {
                "filename": filename,
                "tag": tag,
                "max_size": max_size,
                "exists": exists,
            }

            if exists:
                try:
                    info["size"] = filepath.stat().st_size
                except OSError:
                    info["size"] = -1

            available.append(info)

        return available
