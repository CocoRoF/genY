"""
Database Configuration Module

Manages PostgreSQL database configuration based on environment variables.

Usage:
    from service.database.database_config import database_config

    host = database_config.POSTGRES_HOST.value
    conn_string = database_config.get_connection_string()
"""

import os
from typing import Any


class ConfigValue:
    """Wrapper class that allows accessing configuration values via the .value property."""

    def __init__(self, value: Any):
        self._value = value

    @property
    def value(self) -> Any:
        return self._value

    def __repr__(self) -> str:
        return f"ConfigValue({self._value!r})"

    def __str__(self) -> str:
        return str(self._value)


class DatabaseConfig:
    """
    PostgreSQL Database Configuration Class

    Environment Variables:
        - POSTGRES_HOST: PostgreSQL host (default: localhost)
        - POSTGRES_PORT: PostgreSQL port (default: 5432)
        - POSTGRES_DB: Database name (default: geny)
        - POSTGRES_USER: Database user (default: geny)
        - POSTGRES_PASSWORD: Database password (default: geny123)
        - AUTO_MIGRATION: Enable auto migration (default: true)
    """

    def __init__(self):
        self._load_config()

    def _load_config(self) -> None:
        """Load configuration from environment variables."""
        self.POSTGRES_HOST = ConfigValue(os.getenv("POSTGRES_HOST", "localhost"))
        self.POSTGRES_PORT = ConfigValue(os.getenv("POSTGRES_PORT", "5432"))
        self.POSTGRES_DB = ConfigValue(os.getenv("POSTGRES_DB", "geny"))
        self.POSTGRES_USER = ConfigValue(os.getenv("POSTGRES_USER", "geny"))
        self.POSTGRES_PASSWORD = ConfigValue(os.getenv("POSTGRES_PASSWORD", "geny123"))
        self.DATABASE_TYPE = ConfigValue("postgresql")
        self.AUTO_MIGRATION = ConfigValue(
            os.getenv("AUTO_MIGRATION", "true").lower() in ('true', '1', 'yes', 'on')
        )

    def reload(self) -> None:
        """Reload configuration from environment variables."""
        self._load_config()

    def get_connection_string(self) -> str:
        """Return the PostgreSQL connection string."""
        return (
            f"postgresql://{self.POSTGRES_USER.value}:{self.POSTGRES_PASSWORD.value}"
            f"@{self.POSTGRES_HOST.value}:{self.POSTGRES_PORT.value}/{self.POSTGRES_DB.value}"
        )

    def get_connection_dict(self) -> dict:
        """Return PostgreSQL connection info as a dictionary."""
        return {
            "host": self.POSTGRES_HOST.value,
            "port": self.POSTGRES_PORT.value,
            "database": self.POSTGRES_DB.value,
            "user": self.POSTGRES_USER.value,
            "password": self.POSTGRES_PASSWORD.value,
        }

    def __repr__(self) -> str:
        return (
            f"DatabaseConfig("
            f"host={self.POSTGRES_HOST.value}, "
            f"port={self.POSTGRES_PORT.value}, "
            f"db={self.POSTGRES_DB.value}, "
            f"user={self.POSTGRES_USER.value}, "
            f"auto_migration={self.AUTO_MIGRATION.value})"
        )


# Singleton instance
database_config = DatabaseConfig()


def get_database_config() -> DatabaseConfig:
    """Return the database configuration instance."""
    return database_config


def reload_database_config() -> DatabaseConfig:
    """Reload configuration from environment variables and return the instance."""
    database_config.reload()
    return database_config
