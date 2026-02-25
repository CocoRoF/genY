"""
.env file helper — provides an ``apply_change`` callback factory.

Usage in a ConfigField::

    from service.config.sub_config.general.env_utils import env_sync

    ConfigField(
        name="anthropic_api_key",
        ...
        apply_change=env_sync("ANTHROPIC_API_KEY"),
    )

When the field value changes, the callback writes the new value to the
.env file and updates ``os.environ`` so it takes effect immediately.
"""

from __future__ import annotations

import os
import re
from logging import getLogger
from pathlib import Path
from typing import Any, Callable, Dict, Optional

logger = getLogger(__name__)

# Path to the project .env file (backend root)
_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"

# Placeholder values that should be treated as empty
_PLACEHOLDERS = frozenset({
    "your_api_key_here",
    "your_github_token_here",
    "your_secret_key",
    "your_access_key",
    "your_project_id",
})


# ── Low-level .env helpers ────────────────────────────────────────────

def _read_env() -> str:
    try:
        if _ENV_FILE.exists():
            return _ENV_FILE.read_text(encoding="utf-8")
    except Exception as e:
        logger.warning(f"Failed to read .env: {e}")
    return ""


def _write_env(content: str) -> None:
    try:
        _ENV_FILE.write_text(content, encoding="utf-8")
    except Exception as e:
        logger.error(f"Failed to write .env: {e}")


def _set_value(content: str, key: str, value: str) -> str:
    """Set *key*=*value* in .env content (upsert)."""
    pattern = re.compile(rf"^(\s*#?\s*){re.escape(key)}\s*=.*$", re.MULTILINE)
    new_line = f"{key}={value}"
    if pattern.search(content):
        return pattern.sub(new_line, content, count=1)
    if content and not content.endswith("\n"):
        content += "\n"
    return content + new_line + "\n"


def _to_env_str(value: Any) -> str:
    """Convert a Python value to an env-file-safe string."""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value) if value is not None else ""


def _parse_env_value(content: str, key: str) -> Optional[str]:
    """Extract *key* from .env content. Returns None for missing / commented keys."""
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("#") or "=" not in stripped:
            continue
        k, _, v = stripped.partition("=")
        if k.strip() == key:
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
                v = v[1:-1]
            return v
    return None


# ── Public API ────────────────────────────────────────────────────────

def read_env(env_key: str) -> Optional[str]:
    """
    Read a single value from .env / os.environ.

    Priority: .env file → os.environ → None.
    Placeholder dummy values are mapped to ``""``.
    """
    content = _read_env()
    val = _parse_env_value(content, env_key)
    if val is None:
        val = os.environ.get(env_key)
    if val is None:
        return None
    if val in _PLACEHOLDERS:
        return ""
    return val


def read_env_defaults(field_to_env: Dict[str, str], type_hints: Dict[str, type]) -> Dict[str, Any]:
    """
    Build a kwargs dict by reading each *field_to_env* mapping from the
    .env file / os.environ, casting to the type in *type_hints*.

    Unknown / unset keys are silently skipped.

    Usage::

        _ENV_MAP = {"anthropic_api_key": "ANTHROPIC_API_KEY", ...}

        @classmethod
        def get_default_instance(cls):
            defaults = read_env_defaults(_ENV_MAP, cls.__dataclass_fields__)
            return cls(**defaults)
    """
    kwargs: Dict[str, Any] = {}
    content = _read_env()

    for field_name, env_key in field_to_env.items():
        val = _parse_env_value(content, env_key)
        if val is None:
            val = os.environ.get(env_key)
        if val is None:
            continue
        if val in _PLACEHOLDERS:
            val = ""

        # Cast based on dataclass field type
        hint = type_hints.get(field_name)
        if hint is None:
            kwargs[field_name] = val
            continue

        # Get the actual type (handle dataclass Field objects)
        actual_type = hint.type if hasattr(hint, 'type') else hint

        if actual_type is bool or actual_type == 'bool':
            kwargs[field_name] = val.lower() in ("true", "1", "yes", "on")
        elif actual_type is int or actual_type == 'int':
            try:
                kwargs[field_name] = int(float(val))
            except (ValueError, TypeError):
                pass
        elif actual_type is float or actual_type == 'float':
            try:
                kwargs[field_name] = float(val)
            except (ValueError, TypeError):
                pass
        else:
            kwargs[field_name] = val

    return kwargs

def env_sync(env_key: str) -> Callable[[Any, Any], None]:
    """
    Factory that returns an ``apply_change`` callback.

    The callback writes the **new** value to the .env file and
    updates ``os.environ[env_key]`` so the change takes effect
    without a server restart.
    """

    def _apply(_old_value: Any, new_value: Any) -> None:
        str_val = _to_env_str(new_value)
        # Update .env file
        content = _read_env()
        content = _set_value(content, env_key, str_val)
        _write_env(content)
        # Update live environment
        os.environ[env_key] = str_val
        logger.info(f"env_sync: {env_key} updated")

    return _apply
