"""
Database Module Initialization

Provides the following features using psycopg3-based ConnectionPool:
- Connection pool management (min_size, max_size)
- Automatic idle connection cleanup (max_idle)
- Connection lifetime management (max_lifetime)
- Dead connection detection and disposal (check callback)
- Automatic reconnection (reconnect_timeout)
- Auto recovery on connection loss (retry with backoff)
- Model-based auto table creation and schema migration
"""
from service.database.app_database_manager import AppDatabaseManager
from service.database.database_config import database_config, get_database_config
from service.database.models import APPLICATION_MODELS

__all__ = ['AppDatabaseManager', 'database_config', 'get_database_config', 'APPLICATION_MODELS']
