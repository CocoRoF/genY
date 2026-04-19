"""Resolve the default :class:`MemorySessionRegistry` config from env vars.

Contract
--------
``MEMORY_PROVIDER``  selects the factory key:
  * ``disabled`` → registry stays dormant (``build_default_memory_config``
    returns ``None``), legacy ``SessionMemoryManager`` stays sole owner.
  * ``ephemeral`` (default) → in-memory only. Lost on restart.
  * ``file``     → filesystem-rooted. Requires ``MEMORY_ROOT``.
  * ``sql``      → SQLite or Postgres. Requires ``MEMORY_DSN``.
                   ``MEMORY_DIALECT`` (``sqlite`` | ``postgres``) overrides
                   the DSN-scheme auto-detect.

Optional: ``MEMORY_TIMEZONE``, ``MEMORY_SCOPE`` (default ``session``).

Empty strings are omitted from the config dict so
:class:`MemoryProviderFactory` falls back to its own defaults rather than
seeing blank values.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

from service.memory_provider.exceptions import MemoryConfigError

_DISABLED = "disabled"


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name, default) or default).strip()


def build_default_memory_config() -> Optional[Dict[str, Any]]:
    """Assemble the default factory config dict, or ``None`` if disabled.

    Unlike ``geny-executor-web`` (greenfield), Geny is a legacy target —
    when ``MEMORY_PROVIDER`` is **unset**, the registry stays dormant and
    the existing ``SessionMemoryManager`` keeps full ownership. Operators
    must opt in explicitly.

    Raises :class:`MemoryConfigError` when the declared provider needs
    extra vars that weren't supplied — surfaces a clear startup failure
    instead of crashing later on first session create.
    """
    provider = _env("MEMORY_PROVIDER").lower()
    if provider in ("", _DISABLED, "off", "none"):
        return None

    cfg: Dict[str, Any] = {
        "provider": provider,
        "scope": _env("MEMORY_SCOPE", "session") or "session",
    }

    if provider == "file":
        root = _env("MEMORY_ROOT")
        if not root:
            raise MemoryConfigError(
                "MEMORY_PROVIDER=file requires MEMORY_ROOT to be set"
            )
        cfg["root"] = root
    elif provider == "sql":
        dsn = _env("MEMORY_DSN")
        if not dsn:
            raise MemoryConfigError(
                "MEMORY_PROVIDER=sql requires MEMORY_DSN to be set"
            )
        cfg["dsn"] = dsn
        dialect = _env("MEMORY_DIALECT")
        if dialect:
            cfg["dialect"] = dialect.lower()

    tz = _env("MEMORY_TIMEZONE")
    if tz:
        cfg["timezone"] = tz

    return cfg
