"""
Configuration Manager for Geny Agent.

Handles:
- Loading/saving configs from PostgreSQL database (primary)
- Fallback to JSON files when DB is unavailable
- Auto-discovery of config classes
- Config validation
- Thread-safe config access
- Migration of existing JSON configs to database on first run
"""

import json
import os
from logging import getLogger
from pathlib import Path
from threading import RLock
from typing import Any, Dict, List, Optional, Type, TypeVar

from service.config.base import BaseConfig, get_registered_configs

logger = getLogger(__name__)

T = TypeVar('T', bound=BaseConfig)

# Global config manager instance
_config_manager: Optional['ConfigManager'] = None


class ConfigManager:
    """
    Manages configuration loading, saving, and access.

    Primary storage: PostgreSQL database (persistent_configs table)
    Fallback storage: JSON files in the config directory

    Automatically discovers and registers config classes.
    On first run, migrates existing JSON configs to database.
    """

    def __init__(self, config_dir: Optional[Path] = None, app_db=None):
        """
        Initialize the config manager.

        Args:
            config_dir: Directory to store config files (fallback).
            app_db: AppDatabaseManager instance for DB-backed storage.
        """
        if config_dir is None:
            config_dir = Path(__file__).parent / "variables"

        self.config_dir = Path(config_dir)
        self._ensure_config_dir()

        # Database manager (set later via set_database or at init)
        self._app_db = app_db

        # Cache for loaded configs
        self._configs: Dict[str, BaseConfig] = {}
        self._lock = RLock()

        logger.info(f"ConfigManager initialized with config dir: {self.config_dir}")

    def set_database(self, app_db) -> None:
        """
        Set the database manager for DB-backed config storage.
        Called during application startup after DB initialization.

        Args:
            app_db: AppDatabaseManager instance
        """
        self._app_db = app_db
        logger.info("ConfigManager: Database backend connected")

    @property
    def _db_available(self) -> bool:
        """Check if database is available for config storage"""
        if self._app_db is None:
            return False
        try:
            return self._app_db.db_manager._is_pool_healthy()
        except Exception:
            return False

    def _ensure_config_dir(self):
        """Ensure config directory exists"""
        self.config_dir.mkdir(parents=True, exist_ok=True)

    def _get_config_path(self, config_name: str) -> Path:
        """Get the file path for a config"""
        return self.config_dir / f"{config_name}.json"

    def get_registered_config_classes(self) -> Dict[str, Type[BaseConfig]]:
        """Get all registered config classes"""
        return get_registered_configs()

    def load_config(self, config_class: Type[T], create_if_missing: bool = True) -> T:
        """
        Load a configuration.

        Priority:
        1. In-memory cache
        2. PostgreSQL database (primary storage)
        3. JSON file (fallback / legacy)
        4. Create default if missing

        When loading from JSON file and DB is available, auto-migrates to DB.

        Args:
            config_class: The config class to load
            create_if_missing: If True, create default config if not found

        Returns:
            The loaded or default config instance
        """
        config_name = config_class.get_config_name()
        config_path = self._get_config_path(config_name)

        with self._lock:
            # 1. Check cache first
            if config_name in self._configs:
                return self._configs[config_name]

            config = None
            loaded_from = None

            # 2. Try loading from database
            if self._db_available:
                try:
                    data = self._load_from_db(config_name)
                    if data:
                        config = config_class.from_dict(data)
                        loaded_from = "database"
                        logger.info(f"Loaded config from DB: {config_name}")
                except Exception as e:
                    logger.warning(f"Failed to load config from DB {config_name}: {e}")

            # 3. Fall back to JSON file
            if config is None and config_path.exists():
                try:
                    with open(config_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    config = config_class.from_dict(data)
                    loaded_from = "file"
                    logger.info(f"Loaded config from file: {config_name}")

                    # Auto-migrate JSON config to database
                    if self._db_available:
                        try:
                            self._save_to_db(config_name, config.to_dict())
                            logger.info(f"Migrated config to DB: {config_name}")
                        except Exception as e:
                            logger.warning(f"Failed to migrate config to DB: {config_name}: {e}")
                except Exception as e:
                    logger.error(f"Failed to load config from file {config_name}: {e}")
                    if not create_if_missing:
                        raise

            # 4. Create default if missing
            if config is None:
                if create_if_missing:
                    config = config_class.get_default_instance()
                    loaded_from = "default"
                    self.save_config(config)
                    logger.info(f"Created default config: {config_name}")
                else:
                    raise FileNotFoundError(f"Config not found: {config_name}")

            self._configs[config_name] = config

            # Sync loaded values to os.environ via apply_change callbacks
            self._sync_env_on_load(config)

            return config

    def _sync_env_on_load(self, config: BaseConfig) -> None:
        """Propagate config values to ``os.environ`` on initial load.

        Config JSON files are the single source of truth.  This method
        ensures that values stored in JSON (e.g. ANTHROPIC_API_KEY) are
        available as environment variables at runtime, even when a
        ``.env`` file does not exist.

        Only fields that have an ``apply_change`` callback are synced,
        and only when the config value is non-empty.
        """
        try:
            meta_lookup = {f.name: f for f in config.get_fields_metadata()}
            current = config.to_dict()

            for name, value in current.items():
                if not value:               # skip empty / falsy
                    continue
                meta = meta_lookup.get(name)
                if meta is None or meta.apply_change is None:
                    continue
                try:
                    meta.apply_change(None, value)
                except Exception as exc:
                    logger.debug(
                        f"_sync_env_on_load: callback failed for "
                        f"{config.get_config_name()}.{name}: {exc}"
                    )
        except Exception:
            logger.debug(
                f"_sync_env_on_load: skipped for {config.get_config_name()}",
                exc_info=True,
            )

    def save_config(self, config: BaseConfig) -> bool:
        """
        Save a configuration to database (primary) and file (backup).

        Args:
            config: The config instance to save

        Returns:
            True if saved successfully (to at least one target)
        """
        config_name = config.get_config_name()
        config_path = self._get_config_path(config_name)
        config_data = config.to_dict()
        saved = False

        try:
            with self._lock:
                # 1. Save to database (primary)
                if self._db_available:
                    try:
                        self._save_to_db(config_name, config_data)
                        saved = True
                        logger.debug(f"Saved config to DB: {config_name}")
                    except Exception as e:
                        logger.warning(f"Failed to save config to DB {config_name}: {e}")

                # 2. Save to file (backup / fallback)
                try:
                    with open(config_path, 'w', encoding='utf-8') as f:
                        json.dump(config_data, f, indent=2, ensure_ascii=False)
                    saved = True
                    logger.debug(f"Saved config to file: {config_name}")
                except Exception as e:
                    logger.warning(f"Failed to save config to file {config_name}: {e}")

                # Update cache
                if saved:
                    self._configs[config_name] = config

            if saved:
                logger.info(f"Saved config: {config_name}")
            return saved
        except Exception as e:
            logger.error(f"Failed to save config {config_name}: {e}")
            return False

    def update_config(self, config_name: str, updates: Dict[str, Any]) -> Optional[BaseConfig]:
        """
        Update a configuration with partial data.

        Args:
            config_name: The config name to update
            updates: Dictionary of fields to update

        Returns:
            The updated config instance, or None if failed
        """
        config_classes = self.get_registered_config_classes()

        if config_name not in config_classes:
            logger.error(f"Unknown config: {config_name}")
            return None

        config_class = config_classes[config_name]

        # Load existing config
        config = self.load_config(config_class)

        # Snapshot old values for change detection
        old_values = config.to_dict()

        # Apply updates
        current_data = old_values.copy()
        current_data.update(updates)

        # Create new instance with updated data
        updated_config = config_class.from_dict(current_data)

        # Validate
        errors = updated_config.validate()
        if errors:
            logger.warning(f"Config validation errors for {config_name}: {errors}")
            # Still save but log warnings

        # Save
        if self.save_config(updated_config):
            # Invoke apply_change callbacks for changed fields
            updated_config.apply_field_changes(old_values)
            return updated_config
        return None

    def get_config(self, config_name: str) -> Optional[BaseConfig]:
        """
        Get a config by name.

        Args:
            config_name: The config name

        Returns:
            The config instance or None if not found
        """
        config_classes = self.get_registered_config_classes()

        if config_name not in config_classes:
            return None

        return self.load_config(config_classes[config_name])

    def get_config_value(self, config_name: str, field_name: str, default: Any = None) -> Any:
        """
        Get a specific field value from a config.

        Args:
            config_name: The config name
            field_name: The field name to get
            default: Default value if not found

        Returns:
            The field value or default
        """
        config = self.get_config(config_name)
        if config is None:
            return default
        return getattr(config, field_name, default)

    def get_all_configs(self) -> List[Dict[str, Any]]:
        """
        Get all configs with their values and schemas.

        Returns:
            List of config data with schema and values
        """
        result = []

        for config_name, config_class in self.get_registered_config_classes().items():
            try:
                config = self.load_config(config_class)
                result.append({
                    "schema": config_class.get_schema(),
                    "values": config.to_dict(),
                    "valid": config.is_valid(),
                    "errors": config.validate()
                })
            except Exception as e:
                logger.error(f"Failed to get config {config_name}: {e}")
                result.append({
                    "schema": config_class.get_schema(),
                    "values": {},
                    "valid": False,
                    "errors": [str(e)]
                })

        return result

    def get_all_schemas(self) -> List[Dict[str, Any]]:
        """
        Get schemas for all registered configs.

        Returns:
            List of config schemas
        """
        return [
            config_class.get_schema()
            for config_class in self.get_registered_config_classes().values()
        ]

    def delete_config(self, config_name: str) -> bool:
        """
        Delete a config from database and file.

        Args:
            config_name: The config name to delete

        Returns:
            True if deleted successfully
        """
        config_path = self._get_config_path(config_name)

        try:
            with self._lock:
                # Delete from database
                if self._db_available:
                    try:
                        from service.database.db_config_helper import delete_config_group
                        delete_config_group(self._app_db, config_name)
                        logger.debug(f"Deleted config from DB: {config_name}")
                    except Exception as e:
                        logger.warning(f"Failed to delete config from DB {config_name}: {e}")

                # Delete file
                if config_path.exists():
                    config_path.unlink()

                # Remove from cache
                if config_name in self._configs:
                    del self._configs[config_name]

            logger.info(f"Deleted config: {config_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete config {config_name}: {e}")
            return False

    def reload_config(self, config_name: str) -> Optional[BaseConfig]:
        """
        Reload a config from DB/file, bypassing cache.

        Args:
            config_name: The config name to reload

        Returns:
            The reloaded config instance
        """
        config_classes = self.get_registered_config_classes()

        if config_name not in config_classes:
            return None

        with self._lock:
            # Remove from cache to force reload
            if config_name in self._configs:
                del self._configs[config_name]

        return self.load_config(config_classes[config_name])

    def reload_all_configs(self):
        """Reload all configs from DB/files"""
        with self._lock:
            self._configs.clear()

        for config_class in self.get_registered_config_classes().values():
            try:
                self.load_config(config_class)
            except Exception as e:
                logger.error(f"Failed to reload config {config_class.get_config_name()}: {e}")

    def export_all_configs(self) -> Dict[str, Any]:
        """
        Export all configs to a single dictionary.
        Useful for backup.

        Returns:
            Dictionary with all config data
        """
        return {
            config_name: self.load_config(config_class).to_dict()
            for config_name, config_class in self.get_registered_config_classes().items()
        }

    def import_configs(self, data: Dict[str, Dict[str, Any]]) -> Dict[str, bool]:
        """
        Import configs from a dictionary.

        Args:
            data: Dictionary mapping config names to config data

        Returns:
            Dictionary mapping config names to success status
        """
        results = {}

        config_classes = self.get_registered_config_classes()

        for config_name, config_data in data.items():
            if config_name not in config_classes:
                logger.warning(f"Unknown config during import: {config_name}")
                results[config_name] = False
                continue

            try:
                config = config_classes[config_name].from_dict(config_data)
                results[config_name] = self.save_config(config)
            except Exception as e:
                logger.error(f"Failed to import config {config_name}: {e}")
                results[config_name] = False

        return results

    # ─── Database Helper Methods ──────────────────────────────────────────

    def _load_from_db(self, config_name: str) -> Optional[Dict[str, Any]]:
        """
        Load config data from the persistent_configs database table.

        Each config field is stored as a separate row with:
        - config_name = config name (e.g., "api", "github")
        - config_key = field name (e.g., "anthropic_api_key")
        - config_value = serialized value
        - data_type = type hint for deserialization

        Returns:
            Dictionary of config field values, or None if no data found
        """
        from service.database.db_config_helper import get_config_group
        return get_config_group(self._app_db, config_name)

    def _save_to_db(self, config_name: str, config_data: Dict[str, Any]) -> None:
        """
        Save config data to the persistent_configs database table.

        Each field in config_data is stored as a separate row.

        Args:
            config_name: The config name
            config_data: Dictionary of field name -> value
        """
        from service.database.db_config_helper import save_config_group
        save_config_group(self._app_db, config_name, config_data)

    def migrate_all_to_db(self) -> Dict[str, bool]:
        """
        Migrate all existing JSON configs to the database.
        Called during startup after DB initialization.

        Returns:
            Dictionary mapping config names to migration success status
        """
        if not self._db_available:
            logger.warning("Cannot migrate configs: database not available")
            return {}

        results = {}
        config_classes = self.get_registered_config_classes()

        for config_name, config_class in config_classes.items():
            config_path = self._get_config_path(config_name)
            try:
                # Check if already in DB
                existing = self._load_from_db(config_name)
                if existing:
                    results[config_name] = True
                    logger.debug(f"Config already in DB, skipping migration: {config_name}")
                    continue

                # Load from JSON file
                if config_path.exists():
                    with open(config_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    self._save_to_db(config_name, data)
                    results[config_name] = True
                    logger.info(f"Migrated config to DB: {config_name}")
                else:
                    # Create default and save
                    default = config_class.get_default_instance()
                    self._save_to_db(config_name, default.to_dict())
                    results[config_name] = True
                    logger.info(f"Created default config in DB: {config_name}")
            except Exception as e:
                logger.error(f"Failed to migrate config {config_name}: {e}")
                results[config_name] = False

        return results


def get_config_manager() -> ConfigManager:
    """Get the global config manager instance"""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager


def init_config_manager(config_dir: Optional[Path] = None, app_db=None) -> ConfigManager:
    """
    Initialize the global config manager with custom config directory and optional DB backend.

    Args:
        config_dir: Directory to store config files (fallback)
        app_db: AppDatabaseManager instance for DB-backed storage
    """
    global _config_manager
    _config_manager = ConfigManager(config_dir, app_db=app_db)
    return _config_manager
