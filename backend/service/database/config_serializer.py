"""
Config Serializer — Safe serialization/deserialization utility for config values

Prevents JSON double-serialization issues:
- Does not re-serialize values that are already JSON strings
- Safely handles multi-escaped values during deserialization
"""
import json
import logging
from typing import Any

logger = logging.getLogger("config-serializer")


def safe_serialize(value: Any, data_type: str = None) -> str:
    """
    Safely serialize a config value to a string for DB storage.

    Prevents JSON double-serialization:
    - Only JSON-serializes list/dict types
    - Does not re-serialize values that are already JSON strings
    """
    if value is None:
        return ""

    if isinstance(value, str):
        if _is_json_string(value):
            return value
        return value

    if isinstance(value, bool):
        return str(value).lower()

    if isinstance(value, (int, float)):
        return str(value)

    if isinstance(value, (list, dict)):
        try:
            return json.dumps(value, ensure_ascii=False)
        except (TypeError, ValueError) as e:
            logger.warning(f"Failed to serialize {type(value).__name__}: {e}")
            return str(value)

    return str(value)


def safe_deserialize(value: str, data_type: str = "string") -> Any:
    """
    Safely deserialize a string value from DB to the actual type.

    Handles multi-escaped JSON strings (up to 10 iterations).
    """
    if value is None or value == "":
        return None

    if data_type == "bool":
        return str(value).lower() in ('true', '1', 'yes', 'on', 'enabled')

    if data_type == "int":
        try:
            clean_value = value.strip().strip('"').strip("'")
            return int(clean_value)
        except (ValueError, TypeError):
            return 0

    if data_type == "float":
        try:
            clean_value = value.strip().strip('"').strip("'")
            return float(clean_value)
        except (ValueError, TypeError):
            return 0.0

    if data_type == "list":
        return _safe_parse_json_list(value)

    if data_type == "dict":
        return _safe_parse_json_dict(value)

    # string default
    if isinstance(value, str) and value.startswith('"') and value.endswith('"'):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, str):
                return parsed
        except json.JSONDecodeError:
            pass
    return str(value)


def _is_json_string(value: str) -> bool:
    """Check if a string is valid JSON (list or dict)."""
    if not isinstance(value, str):
        return False
    value = value.strip()
    if not ((value.startswith('[') and value.endswith(']')) or
            (value.startswith('{') and value.endswith('}'))):
        return False
    try:
        parsed = json.loads(value)
        return isinstance(parsed, (list, dict))
    except json.JSONDecodeError:
        return False


def _safe_parse_json_list(value: str, max_depth: int = 10) -> list:
    """Safely parse a multi-escaped JSON list."""
    if not isinstance(value, str) or not value.strip():
        return []

    current = value.strip()
    depth = 0

    while depth < max_depth:
        depth += 1
        if isinstance(current, list):
            return current
        if not isinstance(current, str):
            break
        try:
            parsed = json.loads(current)
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, str):
                if parsed == current:
                    break
                current = parsed
                continue
            break
        except json.JSONDecodeError:
            break

    # Fallback: comma-split
    try:
        clean_value = value.strip().strip('[]')
        if clean_value:
            return [item.strip().strip('"\'') for item in clean_value.split(',') if item.strip()]
    except Exception:
        pass
    return []


def _safe_parse_json_dict(value: str, max_depth: int = 10) -> dict:
    """Safely parse a multi-escaped JSON dictionary."""
    if not isinstance(value, str) or not value.strip():
        return {}

    current = value.strip()
    depth = 0

    while depth < max_depth:
        depth += 1
        if isinstance(current, dict):
            return current
        if not isinstance(current, str):
            break
        try:
            parsed = json.loads(current)
            if isinstance(parsed, dict):
                return parsed
            if isinstance(parsed, str):
                if parsed == current:
                    break
                current = parsed
                continue
            break
        except json.JSONDecodeError:
            break

    return {}


def normalize_config_value(value: Any, data_type: str = None) -> Any:
    """Normalize a config value (recover improperly stored values)."""
    if value is None:
        return None

    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and data_type in ("int", "float", None):
        return value

    if isinstance(value, str):
        if data_type == "list":
            return _safe_parse_json_list(value)
        elif data_type == "dict":
            return _safe_parse_json_dict(value)
        elif data_type == "bool":
            return str(value).lower() in ('true', '1', 'yes', 'on', 'enabled')
        elif data_type == "int":
            try:
                return int(value.strip().strip('"\''))
            except (ValueError, TypeError):
                return 0
        elif data_type == "float":
            try:
                return float(value.strip().strip('"\''))
            except (ValueError, TypeError):
                return 0.0

    return value
