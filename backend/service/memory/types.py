"""
Shared data types for the memory subsystem.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class MemorySource(str, Enum):
    """Where a memory entry originated."""
    LONG_TERM = "long_term"       # MEMORY.md / memory/*.md files
    SHORT_TERM = "short_term"     # JSONL transcript entries
    BOOTSTRAP = "bootstrap"       # Project context files (AGENTS.md, etc.)


# Valid categories for structured memory notes.
MEMORY_CATEGORIES = ("daily", "topics", "entities", "projects", "insights", "root")

# Valid importance levels.
IMPORTANCE_LEVELS = ("critical", "high", "medium", "low")


@dataclass
class MemoryEntry:
    """A single piece of stored memory.

    Both long-term (markdown heading sections) and short-term
    (transcript turns) are normalized into this structure.
    """
    source: MemorySource
    content: str
    timestamp: Optional[datetime] = None
    filename: Optional[str] = None
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Structured metadata (populated for frontmatter-enabled files)
    title: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    importance: str = "medium"
    links_to: List[str] = field(default_factory=list)
    linked_from: List[str] = field(default_factory=list)
    summary: Optional[str] = None

    @property
    def char_count(self) -> int:
        return len(self.content)

    @property
    def token_estimate(self) -> int:
        """Rough token estimate (3 chars ≈ 1 token for mixed en/ko)."""
        return max(1, len(self.content) // 3)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to a plain dict for API responses."""
        return {
            "source": self.source.value,
            "content": self.content,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "filename": self.filename,
            "title": self.title,
            "category": self.category,
            "tags": self.tags,
            "importance": self.importance,
            "links_to": self.links_to,
            "linked_from": self.linked_from,
            "summary": self.summary,
            "char_count": self.char_count,
            "metadata": self.metadata,
        }


@dataclass
class MemorySearchResult:
    """A search hit with relevance score."""
    entry: MemoryEntry
    score: float = 0.0
    snippet: str = ""
    match_type: str = "keyword"  # "keyword" | "recency" | "combined"

    @property
    def source(self) -> MemorySource:
        return self.entry.source

    @property
    def content(self) -> str:
        return self.entry.content

    def to_dict(self) -> Dict[str, Any]:
        """Serialize for API responses."""
        return {
            "entry": self.entry.to_dict(),
            "score": self.score,
            "snippet": self.snippet,
            "match_type": self.match_type,
        }


@dataclass
class MemoryStats:
    """Aggregate statistics about the memory store."""
    long_term_entries: int = 0
    short_term_entries: int = 0
    long_term_chars: int = 0
    short_term_chars: int = 0
    total_files: int = 0
    last_write: Optional[datetime] = None
    # Structured memory stats
    categories: Dict[str, int] = field(default_factory=dict)
    total_tags: int = 0
    total_links: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Serialize for API responses."""
        return {
            "long_term_entries": self.long_term_entries,
            "short_term_entries": self.short_term_entries,
            "long_term_chars": self.long_term_chars,
            "short_term_chars": self.short_term_chars,
            "total_files": self.total_files,
            "last_write": self.last_write.isoformat() if self.last_write else None,
            "categories": self.categories,
            "total_tags": self.total_tags,
            "total_links": self.total_links,
        }
