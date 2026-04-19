"""LTM adapter — bridges legacy LongTermMemory ↔ MemoryProvider.

Phase 5b scaffold. Lands the call sites and the flag gate so the next
PR can swap the body for real provider writes (`Layer.LONG_TERM`)
without touching the caller. Today the adapter always declines
(returns ``False``), which keeps the legacy ``LongTermMemory.append``
/``write_dated``/``write_topic`` paths authoritative.

When ``MEMORY_LEGACY_LTM=false`` and the provider write surface is
finalized, this module will:
  1. Resolve the session's ``MemoryProvider`` from
     :class:`service.memory_provider.registry.MemorySessionRegistry`.
  2. Call ``provider.write(layer=Layer.LONG_TERM, ...)`` (or the
     equivalent provider write surface) with text/heading/topic
     mapped to the provider's schema.
  3. Return ``True`` to signal the caller it must skip the legacy write.
"""

from __future__ import annotations

from logging import getLogger
from typing import Optional

from service.memory_provider.flags import legacy_ltm_enabled

logger = getLogger(__name__)

_WARNED_ONCE = False


def _maybe_warn() -> None:
    global _WARNED_ONCE
    if _WARNED_ONCE:
        return
    logger.warning(
        "MEMORY_LEGACY_LTM=false but provider-backed LTM is not yet "
        "implemented; falling back to legacy LongTermMemory. "
        "Set MEMORY_LEGACY_LTM=true (or unset) to silence this."
    )
    _WARNED_ONCE = True


def try_append(
    session_id: Optional[str],
    text: str,
    heading: Optional[str] = None,
) -> bool:
    """Attempt to route ``LongTermMemory.append`` through the provider."""
    if legacy_ltm_enabled():
        return False
    _maybe_warn()
    return False


def try_write_dated(session_id: Optional[str], text: str) -> bool:
    """Attempt to route ``LongTermMemory.write_dated`` through the provider."""
    if legacy_ltm_enabled():
        return False
    _maybe_warn()
    return False


def try_write_topic(
    session_id: Optional[str],
    topic: str,
    text: str,
) -> bool:
    """Attempt to route ``LongTermMemory.write_topic`` through the provider."""
    if legacy_ltm_enabled():
        return False
    _maybe_warn()
    return False


__all__ = ["try_append", "try_write_dated", "try_write_topic"]
