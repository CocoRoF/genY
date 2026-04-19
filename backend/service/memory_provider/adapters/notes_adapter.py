"""Notes adapter — bridges legacy StructuredMemoryWriter ↔ MemoryProvider.

Phase 5c scaffold. Wires write/update/delete/link of Obsidian-style
notes (the IndexEntry-backed marker storage layer) to a flag-gated
adapter so a follow-up PR can swap the bodies for real
``provider.notes(...).{store,update,delete,link}`` calls without
touching the caller.

Today every adapter declines (returns ``False`` / ``None``), keeping
the legacy ``StructuredMemoryWriter`` path authoritative — behavior
is unchanged.
"""

from __future__ import annotations

from logging import getLogger
from typing import List, Optional

from service.memory_provider.flags import legacy_notes_enabled

logger = getLogger(__name__)

_WARNED_ONCE = False


def _maybe_warn() -> None:
    global _WARNED_ONCE
    if _WARNED_ONCE:
        return
    logger.warning(
        "MEMORY_LEGACY_NOTES=false but provider-backed notes are not yet "
        "implemented; falling back to legacy StructuredMemoryWriter. "
        "Set MEMORY_LEGACY_NOTES=true (or unset) to silence this."
    )
    _WARNED_ONCE = True


def try_write_note(
    session_id: Optional[str],
    title: str,
    content: str,
    *,
    category: str = "topics",
    tags: Optional[List[str]] = None,
    importance: str = "medium",
    source: str = "system",
    links_to: Optional[List[str]] = None,
) -> Optional[str]:
    """Attempt to write a note via provider.

    Returns:
        Filename string if provider accepted the write, ``None`` if the
        legacy path should run. The signature mirrors
        ``StructuredMemoryWriter.write_note`` so caller logic stays
        symmetric.
    """
    if legacy_notes_enabled():
        return None
    _maybe_warn()
    return None


def try_update_note(
    session_id: Optional[str],
    filename: str,
    *,
    body: Optional[str] = None,
    tags: Optional[List[str]] = None,
    importance: Optional[str] = None,
) -> Optional[bool]:
    """Attempt to update a note via provider.

    Returns:
        ``True``/``False`` if provider handled the update, ``None`` if
        the legacy path should run.
    """
    if legacy_notes_enabled():
        return None
    _maybe_warn()
    return None


def try_delete_note(
    session_id: Optional[str],
    filename: str,
) -> Optional[bool]:
    """Attempt to delete a note via provider.

    Returns:
        ``True``/``False`` if provider handled the delete, ``None`` if
        the legacy path should run.
    """
    if legacy_notes_enabled():
        return None
    _maybe_warn()
    return None


def try_link_notes(
    session_id: Optional[str],
    source_filename: str,
    target_filename: str,
) -> Optional[bool]:
    """Attempt to create a wikilink via provider.

    Returns:
        ``True``/``False`` if provider handled the link, ``None`` if
        the legacy path should run.
    """
    if legacy_notes_enabled():
        return None
    _maybe_warn()
    return None


__all__ = [
    "try_write_note",
    "try_update_note",
    "try_delete_note",
    "try_link_notes",
]
