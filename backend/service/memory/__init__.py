"""
Memory subsystem for Geny Agent.

Provides long-term and short-term memory backed by files inside the
session's storage directory, inspired by OpenClaw's MEMORY.md +
session JSONL patterns.

Includes an optional FAISS-backed vector memory layer for semantic
search (see ``VectorMemoryManager``).

Structured memory layer (Obsidian-like):
    StructuredMemoryWriter — frontmatter-based note creation
    MemoryIndexManager     — in-memory file index with tags/links
    MemoryMigrator         — legacy file migration

Public API:
    SessionMemoryManager   — per-session facade
    LongTermMemory         — MEMORY.md file I/O
    ShortTermMemory        — JSONL transcript I/O
    VectorMemoryManager    — FAISS vector indexing & retrieval
    MemorySearchResult     — search hit dataclass
"""

from service.memory.manager import SessionMemoryManager
from service.memory.long_term import LongTermMemory
from service.memory.short_term import ShortTermMemory
from service.memory.vector_memory import VectorMemoryManager
from service.memory.structured_writer import StructuredMemoryWriter
from service.memory.index import MemoryIndexManager
from service.memory.types import MemoryEntry, MemorySearchResult, MemoryStats
from service.memory.global_memory import GlobalMemoryManager, get_global_memory_manager
from service.memory.curated_knowledge import CuratedKnowledgeManager, get_curated_knowledge_manager

__all__ = [
    "SessionMemoryManager",
    "LongTermMemory",
    "ShortTermMemory",
    "VectorMemoryManager",
    "StructuredMemoryWriter",
    "MemoryIndexManager",
    "MemoryEntry",
    "MemorySearchResult",
    "MemoryStats",
    "CuratedKnowledgeManager",
    "get_curated_knowledge_manager",
]
