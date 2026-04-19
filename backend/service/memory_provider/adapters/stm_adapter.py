"""STM adapter — bridges legacy ShortTermMemory ↔ MemoryProvider.

Phase 5a scaffold. Lands the *call site* and the flag gate so subsequent
PRs can swap the body for a real provider write without touching the
caller again. Today the adapter always declines (returns ``False``),
which keeps the legacy ``ShortTermMemory.add_message`` path
authoritative — behavior-neutral by construction.

When ``MEMORY_LEGACY_STM=false`` and the provider STM API is finalized,
this function will:
  1. Resolve the session's ``MemoryProvider`` from
     :class:`service.memory_provider.registry.MemorySessionRegistry`.
  2. Call ``provider.notes(...).store(...)`` (or the equivalent STM
     write surface once the provider exposes one) with role/content/
     metadata mapped to the provider's schema.
  3. Return ``True`` to signal the caller it must skip the legacy write.

Until that surface lands, declining keeps the legacy path live and the
caller code shape unchanged.
"""

from __future__ import annotations

from logging import getLogger
from typing import Any, Mapping, Optional

from service.memory_provider.flags import legacy_stm_enabled

logger = getLogger(__name__)

_WARNED_ONCE = False


def try_record_message(
    session_id: Optional[str],
    role: str,
    content: str,
    metadata: Optional[Mapping[str, Any]] = None,
) -> bool:
    """Attempt to route a STM write through the MemoryProvider.

    Returns:
        ``True`` if the provider accepted the write (caller must skip
        the legacy path). ``False`` if the legacy path should run — the
        default while the provider STM write surface is still under
        design.
    """
    if legacy_stm_enabled():
        return False

    global _WARNED_ONCE
    if not _WARNED_ONCE:
        logger.warning(
            "MEMORY_LEGACY_STM=false but provider-backed STM is not yet "
            "implemented; falling back to legacy ShortTermMemory. "
            "Set MEMORY_LEGACY_STM=true (or unset) to silence this."
        )
        _WARNED_ONCE = True
    return False


__all__ = ["try_record_message"]
