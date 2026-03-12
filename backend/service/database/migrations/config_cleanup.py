"""
Config Cleanup Migration

Cleans up multi-escaped config values that were incorrectly stored in DB.
Automatically runs at app startup.
"""
import json
import logging
from typing import Any

logger = logging.getLogger("config-cleanup")


def cleanup_escaped_configs(db_manager) -> dict:
    """
    Clean up multi-escaped config values stored in DB.
    """
    from service.database.config_serializer import safe_deserialize, safe_serialize

    result = {
        "total": 0,
        "cleaned": 0,
        "errors": 0,
        "details": []
    }

    actual_manager = db_manager
    if hasattr(db_manager, 'db_manager'):
        actual_manager = db_manager.db_manager

    if actual_manager is None:
        logger.error("DB manager is not available")
        return result

    try:
        query = "SELECT id, config_name, config_key, config_value, data_type FROM persistent_configs"
        configs = actual_manager.execute_query(query)

        if not configs:
            logger.info("No configs found to clean")
            return result

        result["total"] = len(configs)

        for config in configs:
            config_id = config.get('id')
            config_name = config.get('config_name')
            config_key = config.get('config_key')
            old_value = config.get('config_value')
            data_type = config.get('data_type', 'string')

            if not _needs_cleanup(old_value, data_type):
                continue

            try:
                cleaned_value = safe_deserialize(old_value, data_type)
                new_value_str = safe_serialize(cleaned_value, data_type)

                if old_value == new_value_str:
                    continue

                update_query = """
                    UPDATE persistent_configs
                    SET config_value = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """
                actual_manager.execute_update_delete(update_query, (new_value_str, config_id))

                result["cleaned"] += 1
                result["details"].append({
                    "config_name": config_name,
                    "config_key": config_key,
                    "data_type": data_type,
                    "old_value": old_value[:100] + "..." if len(str(old_value)) > 100 else old_value,
                    "new_value": new_value_str[:100] + "..." if len(str(new_value_str)) > 100 else new_value_str
                })

                logger.info(f"Cleaned config: {config_name}.{config_key}")

            except Exception as e:
                result["errors"] += 1
                logger.error(f"Failed to clean config {config_name}.{config_key}: {e}")

        logger.info(
            f"Config cleanup completed: {result['cleaned']}/{result['total']} cleaned, "
            f"{result['errors']} errors"
        )

    except Exception as e:
        logger.error(f"Config cleanup failed: {e}")
        result["errors"] += 1

    return result


def _needs_cleanup(value: str, data_type: str) -> bool:
    """Check if a value is multi-escaped and needs cleanup."""
    if not isinstance(value, str):
        return False

    if data_type in ("list", "dict"):
        value_stripped = value.strip()

        if data_type == "list":
            if value_stripped.startswith('[') and value_stripped.endswith(']'):
                try:
                    parsed = json.loads(value_stripped)
                    if isinstance(parsed, list):
                        return False
                except json.JSONDecodeError:
                    pass

        if data_type == "dict":
            if value_stripped.startswith('{') and value_stripped.endswith('}'):
                try:
                    parsed = json.loads(value_stripped)
                    if isinstance(parsed, dict):
                        return False
                except json.JSONDecodeError:
                    pass

        if value_stripped.startswith('"[') or value_stripped.startswith('"{'):
            return True
        if '\\\\' in value_stripped:
            return True
        if not (value_stripped.startswith('[') or value_stripped.startswith('{')):
            return True

    return False


def run_cleanup_migration(db_manager) -> bool:
    """Migration function that can be automatically run at app startup."""
    try:
        logger.info("Running config cleanup migration...")
        result = cleanup_escaped_configs(db_manager)

        if result["cleaned"] > 0:
            logger.info(f"Migration completed: {result['cleaned']} configs cleaned")
        else:
            logger.info("No cleanup needed, all configs are valid")

        return result["errors"] == 0
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        return False
