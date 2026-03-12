"""
DB Config Helper

Simple helper functions for reading and writing configuration from/to DB.
Supports both AppDatabaseManager and DatabaseManager.
"""
import logging
from typing import Any, Optional, Dict, TYPE_CHECKING

if TYPE_CHECKING:
    from service.database.database_manager import DatabaseManager
    from service.database.app_database_manager import AppDatabaseManager

from service.database.config_serializer import safe_serialize, safe_deserialize

logger = logging.getLogger("db-config-helper")


def _get_db_manager(db_manager):
    """Extract the actual DatabaseManager instance from db_manager."""
    if db_manager is None:
        return None
    if hasattr(db_manager, 'db_manager'):
        return db_manager.db_manager
    return db_manager


def _is_db_available(db_manager) -> bool:
    """Check if the DB connection is available."""
    actual_manager = _get_db_manager(db_manager)
    if actual_manager is None:
        return False
    if hasattr(actual_manager, '_is_pool_healthy'):
        return actual_manager._is_pool_healthy()
    return False


def get_db_config(db_manager, config_name: str, config_key: str) -> Optional[Any]:
    """Get a config value from DB."""
    actual_manager = _get_db_manager(db_manager)
    if not _is_db_available(db_manager):
        return None

    try:
        query = """
            SELECT config_value, data_type
            FROM persistent_configs
            WHERE config_name = %s AND config_key = %s
            LIMIT 1
        """
        result = actual_manager.execute_query_one(query, (config_name, config_key))
        if result:
            value = result.get('config_value')
            data_type = result.get('data_type', 'string')
            return safe_deserialize(value, data_type)
        return None
    except Exception as e:
        logger.debug(f"Failed to get config from DB: {config_name}.{config_key} - {e}")
        return None


def set_db_config(db_manager, config_name: str, config_key: str,
                  config_value: Any, config_type: str = "string",
                  category: Optional[str] = None) -> bool:
    """Save a config value to DB (UPSERT)."""
    actual_manager = _get_db_manager(db_manager)
    if not _is_db_available(db_manager):
        return False

    try:
        value_str = safe_serialize(config_value, config_type)
        category = category or ""

        # UPSERT via ON CONFLICT — persistent_configs table
        # requires UNIQUE (config_name, config_key) constraint
        upsert_query = """
            INSERT INTO persistent_configs (config_name, config_key, config_value, data_type, category)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (config_name, config_key)
            DO UPDATE SET
                config_value = EXCLUDED.config_value,
                data_type = EXCLUDED.data_type,
                category = EXCLUDED.category,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """
        actual_manager.execute_insert(
            upsert_query, (config_name, config_key, value_str, config_type, category)
        )

        logger.debug(f"Saved config to DB: {config_name}.{config_key}")
        return True
    except Exception as e:
        logger.error(f"Failed to save config to DB: {config_name}.{config_key} - {e}")
        return False


def get_all_db_configs(db_manager) -> Dict[str, Dict[str, Any]]:
    """
    Get all configs from DB.

    Returns:
        {config_name: {config_key: config_value, ...}, ...}
    """
    actual_manager = _get_db_manager(db_manager)
    if not _is_db_available(db_manager):
        return {}

    try:
        query = "SELECT config_name, config_key, config_value, data_type FROM persistent_configs"
        results = actual_manager.execute_query(query)
        if not results:
            return {}

        configs = {}
        for row in results:
            name = row.get('config_name')
            key = row.get('config_key')
            value = row.get('config_value')
            data_type = row.get('data_type', 'string')

            if name not in configs:
                configs[name] = {}
            configs[name][key] = safe_deserialize(value, data_type)

        return configs
    except Exception as e:
        logger.error(f"Failed to get all configs from DB: {e}")
        return {}


def get_config_group(db_manager, config_name: str) -> Dict[str, Any]:
    """
    Get all key-value pairs for a specific config_name.

    Returns:
        {config_key: config_value, ...}
    """
    actual_manager = _get_db_manager(db_manager)
    if not _is_db_available(db_manager):
        return {}

    try:
        query = """
            SELECT config_key, config_value, data_type
            FROM persistent_configs
            WHERE config_name = %s
        """
        results = actual_manager.execute_query(query, (config_name,))
        if not results:
            return {}

        config_data = {}
        for row in results:
            key = row.get('config_key')
            value = row.get('config_value')
            data_type = row.get('data_type', 'string')
            config_data[key] = safe_deserialize(value, data_type)

        return config_data
    except Exception as e:
        logger.error(f"Failed to get config group {config_name}: {e}")
        return {}


def delete_config_group(db_manager, config_name: str) -> bool:
    """Delete all records for a specific config_name."""
    actual_manager = _get_db_manager(db_manager)
    if not _is_db_available(db_manager):
        return False

    try:
        query = "DELETE FROM persistent_configs WHERE config_name = %s"
        actual_manager.execute_update_delete(query, (config_name,))
        return True
    except Exception as e:
        logger.error(f"Failed to delete config group {config_name}: {e}")
        return False


def save_config_group(db_manager, config_name: str, data: Dict[str, Any],
                      category: str = "general") -> bool:
    """Batch save all key-value pairs for a config_name."""
    try:
        for key, value in data.items():
            data_type = _infer_data_type(value)
            if not set_db_config(db_manager, config_name, key, value, data_type, category):
                logger.warning(f"Failed to save config: {config_name}.{key}")
        return True
    except Exception as e:
        logger.error(f"Failed to save config group {config_name}: {e}")
        return False


def _infer_data_type(value: Any) -> str:
    """Infer data type from value."""
    if isinstance(value, bool):
        return "bool"
    elif isinstance(value, int):
        return "int"
    elif isinstance(value, float):
        return "float"
    elif isinstance(value, list):
        return "list"
    elif isinstance(value, dict):
        return "dict"
    return "string"
