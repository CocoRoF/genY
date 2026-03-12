"""
Config Serializer — 설정 값의 안전한 직렬화/역직렬화 유틸리티

JSON 이중 직렬화 문제 방지:
- 이미 JSON 문자열인 값을 다시 직렬화하지 않음
- 역직렬화 시 다중 이스케이프된 값을 안전하게 처리
"""
import json
import logging
from typing import Any

logger = logging.getLogger("config-serializer")


def safe_serialize(value: Any, data_type: str = None) -> str:
    """
    설정 값을 DB 저장용 문자열로 안전하게 직렬화

    JSON 이중 직렬화 방지:
    - list/dict 타입만 JSON 직렬화
    - 이미 JSON 문자열인 경우 재직렬화하지 않음
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
    DB에서 읽은 문자열 값을 실제 타입으로 안전하게 역직렬화

    다중 이스케이프된 JSON 문자열 처리 (최대 10번 반복)
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
    """문자열이 유효한 JSON (list 또는 dict)인지 확인"""
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
    """다중 이스케이프된 JSON 리스트를 안전하게 파싱"""
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
    """다중 이스케이프된 JSON 딕셔너리를 안전하게 파싱"""
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
    """설정 값을 정규화 (이미 잘못 저장된 값 복구)"""
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
