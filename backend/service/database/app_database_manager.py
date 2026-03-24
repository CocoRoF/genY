"""
psycopg3-based AppDatabaseManager

Provides a high-level ORM-like interface,
internally using DatabaseManager's connection pool.

Key features:
1. Model-based CRUD: insert(model), update(model), delete(model_class, id), find_by_id, find_all, find_by_condition
2. Table-name-based CRUD: insert_record, update_record, delete_record, find_records, find_records_by_condition
3. Auto table creation: register_models -> create_tables
4. Auto migration: run_migrations -> schema diff + ALTER TABLE ADD COLUMN
5. Query operators: __like__, __not__, __gte__, __lte__, __gt__, __lt__, __in__, __notin__
6. Auto recovery: all CRUD operations include retry + auto-recovery
"""
import logging
import json
import time
from typing import List, Dict, Any, Optional, Type, Callable, TypeVar

from service.database.database_manager import DatabaseManager
from service.database.models.base_model import BaseModel
from service.database.config_serializer import safe_serialize

logger = logging.getLogger("app-database")

T = TypeVar('T')


class AppDatabaseManager:
    """
    Application Database Manager

    Provides model-based + table-name-based dual interfaces,
    with automatic recovery + retry on connection failures.
    """

    def __init__(self, database_config=None):
        # If database_config is None, DatabaseManager internally uses the singleton
        self.db_manager = DatabaseManager(database_config)
        self.db_config = self.db_manager.config
        self.logger = logger
        self._models_registry: List[Type[BaseModel]] = []

        # Recovery and retry settings
        self._max_retries = 3
        self._retry_delay = 1.0
        self._retry_backoff = 2.0
        self._last_health_check = 0
        self._health_check_interval = 30
        self._auto_recover = True

    # ============================================================
    #  Serialization helpers
    # ============================================================

    def _serialize_value(self, value: Any) -> Any:
        """Convert dict/list types to JSON strings."""
        if isinstance(value, dict):
            return json.dumps(value, ensure_ascii=False, default=str)
        elif isinstance(value, list):
            if value and not all(isinstance(item, str) for item in value):
                return json.dumps(value, ensure_ascii=False, default=str)
            return value
        return value

    def _serialize_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Serialize all values in a data dictionary."""
        return {k: self._serialize_value(v) for k, v in data.items()}

    # ============================================================
    #  Connection management
    # ============================================================

    def _ensure_connection(self) -> bool:
        """Check connection status and recover if necessary."""
        current_time = time.time()
        if current_time - self._last_health_check < self._health_check_interval:
            return True
        try:
            if self.check_health():
                self._last_health_check = current_time
                return True
            else:
                return self.reconnect()
        except Exception as e:
            self.logger.warning(f"Connection ensure failed: {e}")
            return self.reconnect()

    def _with_auto_recovery(self, operation: Callable[[], T], operation_name: str = "operation") -> T:
        """Execution wrapper with automatic recovery."""
        last_exception = None
        current_delay = self._retry_delay

        for attempt in range(self._max_retries + 1):
            try:
                if attempt > 0:
                    self._ensure_connection()
                return operation()
            except Exception as e:
                last_exception = e
                error_str = str(e).lower()
                is_retryable = any(keyword in error_str for keyword in [
                    'connection', 'timeout', 'closed', 'refused',
                    'reset', 'broken', 'network', 'operational',
                    'interface', 'pool', 'unavailable'
                ])
                if is_retryable and attempt < self._max_retries:
                    self.logger.warning(
                        f"{operation_name} failed (attempt {attempt + 1}/{self._max_retries + 1}): {e}. "
                        f"Retrying in {current_delay:.1f}s..."
                    )
                    time.sleep(current_delay)
                    current_delay *= self._retry_backoff
                    self.reconnect()
                else:
                    raise
        raise last_exception

    def check_health(self) -> bool:
        """Check database connection status."""
        try:
            return self.db_manager.health_check(auto_recover=self._auto_recover)
        except Exception as e:
            self.logger.error("Database health check failed: %s", e)
            return False

    def reconnect(self) -> bool:
        """Reconnect to database."""
        try:
            self.logger.info("Attempting database reconnection...")
            if self.db_manager.reconnect():
                self.logger.info("Database reconnection successful")
                self._last_health_check = time.time()
                return True
            else:
                self.logger.error("Database reconnection failed")
                return False
        except Exception as e:
            self.logger.error(f"Failed to reconnect database: {e}")
            return False

    def get_pool_stats(self) -> Dict[str, Any]:
        """Return connection pool status statistics."""
        return self.db_manager.get_pool_stats()

    def check_and_refresh_pool(self) -> bool:
        """Check pool status and refresh if necessary."""
        return self.db_manager.check_and_refresh_pool()

    # ============================================================
    #  Model registration & initialization
    # ============================================================

    def register_model(self, model_class: Type[BaseModel]):
        """Register a model class."""
        if model_class not in self._models_registry:
            self._models_registry.append(model_class)
            self.logger.info("Registered model: %s", model_class.__name__)

    def register_models(self, model_classes: List[Type[BaseModel]]):
        """Register multiple model classes at once."""
        for model_class in model_classes:
            self.register_model(model_class)

    def initialize_database(self, create_tables: bool = True) -> bool:
        """Connect to database and create tables + auto migration."""
        last_error = None

        for attempt in range(self._max_retries + 1):
            try:
                if not self.db_manager.connect():
                    raise ConnectionError("Failed to connect to database")

                self.logger.info("Connected to database with connection pool")
                self._last_health_check = time.time()

                if create_tables:
                    if not self.create_tables():
                        raise RuntimeError("Failed to create tables")

                # Run auto migration (schema diff -> ALTER TABLE ADD COLUMN)
                if self.db_config and hasattr(self.db_config, 'AUTO_MIGRATION'):
                    auto_migrate = self.db_config.AUTO_MIGRATION
                    if hasattr(auto_migrate, 'value'):
                        auto_migrate = auto_migrate.value
                    if auto_migrate:
                        self.run_migrations()

                return True
            except Exception as e:
                last_error = e
                if attempt < self._max_retries:
                    delay = self._retry_delay * (self._retry_backoff ** attempt)
                    self.logger.warning(
                        f"Database initialization failed (attempt {attempt + 1}/{self._max_retries + 1}): {e}. "
                        f"Retrying in {delay:.1f}s..."
                    )
                    time.sleep(delay)
                else:
                    self.logger.error(
                        "Failed to initialize database after %d attempts: %s",
                        self._max_retries + 1, last_error
                    )
        return False

    def initialize_connection(self) -> bool:
        """Connect to database only (without table creation)."""
        return self.initialize_database(create_tables=False)

    def create_tables(self) -> bool:
        """Create tables for all registered models."""
        try:
            db_type = self.db_manager.db_type

            for model_class in self._models_registry:
                instance = model_class()
                table_name = instance.get_table_name()
                create_query = model_class.get_create_table_query(db_type)

                self.logger.info("Creating table: %s", table_name)
                self.db_manager.execute_query(create_query)

                # Auto-create indexes defined in the model
                for idx_name, columns in instance.get_indexes():
                    try:
                        idx_query = f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table_name}({columns})"
                        self.db_manager.execute_query(idx_query)
                        self.logger.info("Created index %s for table: %s", idx_name, table_name)
                    except Exception as e:
                        self.logger.warning("Failed to create index %s for %s: %s", idx_name, table_name, e)

            # Auto-add columns that might be missing in existing tables
            for model_class in self._models_registry:
                instance = model_class()
                table_name = instance.get_table_name()
                schema = instance.get_schema()
                for col_name, col_type in schema.items():
                    try:
                        alter_q = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                        self.db_manager.execute_query(alter_q)
                    except Exception:
                        pass  # Column likely already exists or DB doesn't support IF NOT EXISTS

            # Add UNIQUE constraint to persistent_configs table if not present
            self._ensure_unique_constraint("persistent_configs", "config_name", "config_key")

            self.logger.info("All application tables created successfully")
            return True
        except Exception as e:
            self.logger.error("Failed to create application tables: %s", e)
            return False

    def _ensure_unique_constraint(self, table_name: str, *columns: str) -> None:
        """Add UNIQUE constraint to table if not present (backward compatible with existing tables)."""
        try:
            col_csv = ", ".join(columns)
            constraint_name = f"uq_{table_name}_{'_'.join(columns)}"

            # Check if constraint exists
            check_query = """
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_name = %s AND constraint_type = 'UNIQUE'
                LIMIT 1
            """
            existing = self.db_manager.execute_query_one(check_query, (table_name,))
            if existing:
                return

            alter_query = f"""
                ALTER TABLE {table_name}
                ADD CONSTRAINT {constraint_name} UNIQUE ({col_csv})
            """
            self.db_manager.execute_query(alter_query)
            self.logger.info("Added UNIQUE constraint %s on %s(%s)", constraint_name, table_name, col_csv)
        except Exception as e:
            # Ignore if already exists or has duplicate data
            self.logger.debug("UNIQUE constraint check for %s: %s", table_name, e)

    # ============================================================
    #  Model-based CRUD
    # ============================================================

    def insert(self, model: BaseModel) -> Optional[Dict]:
        """Insert a model instance into the database."""
        def _do_insert():
            db_type = self.db_manager.db_type
            query, values = model.get_insert_query(db_type)

            if db_type == "postgresql":
                query += " RETURNING id"
                insert_id = self.db_manager.execute_insert(query, tuple(values))
            else:
                insert_id = self.db_manager.execute_insert(query, tuple(values))

            return {"result": "success", "id": insert_id}

        try:
            return self._with_auto_recovery(_do_insert, "insert")
        except Exception as e:
            self.logger.error("Failed to insert %s: %s", model.__class__.__name__, e)
            return None

    def update(self, model: BaseModel) -> bool:
        """Update a model instance in the database."""
        def _do_update():
            db_type = self.db_manager.db_type
            query, values = model.get_update_query(db_type)
            self.db_manager.execute_update_delete(query, tuple(values))
            return {"result": "success"}

        try:
            return self._with_auto_recovery(_do_update, "update")
        except Exception as e:
            self.logger.error("Failed to update %s: %s", model.__class__.__name__, e)
            return False

    def update_config(self, config_name: str, config_key: str, config_value: Any,
                      data_type: str = "string", category: str = None) -> bool:
        """Update config value (UPSERT via ON CONFLICT)."""
        try:
            table_name = "persistent_configs"
            value_str = safe_serialize(config_value, data_type)

            upsert_query = f"""
                INSERT INTO {table_name} (config_name, config_key, config_value, data_type, category)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (config_name, config_key)
                DO UPDATE SET
                    config_value = EXCLUDED.config_value,
                    data_type = EXCLUDED.data_type,
                    category = EXCLUDED.category,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
            """
            result = self.db_manager.execute_insert(
                upsert_query, (config_name, config_key, value_str, data_type, category or "")
            )
            return result is not None
        except Exception as e:
            self.logger.error("Failed to update config in DB: %s.%s - %s", config_name, config_key, e)
            return False

    def delete(self, model_class: Type[BaseModel], record_id: int) -> bool:
        """Delete a record by ID."""
        try:
            table_name = model_class().get_table_name()
            query = f"DELETE FROM {table_name} WHERE id = %s"
            affected_rows = self.db_manager.execute_update_delete(query, (record_id,))
            return affected_rows is not None and affected_rows > 0
        except Exception as e:
            self.logger.error("Failed to delete %s with id %s: %s", model_class.__name__, record_id, e)
            return False

    def delete_by_condition(self, model_class: Type[BaseModel], conditions: Dict[str, Any]) -> bool:
        """Delete records by condition."""
        try:
            table_name = model_class().get_table_name()
            where_clauses = []
            values = []

            for key, value in conditions.items():
                self._build_where_clause(key, value, where_clauses, values)

            if not conditions:
                self.logger.warning("No conditions provided for delete_by_condition. Aborting.")
                return False

            where_clause = " AND ".join(where_clauses) if where_clauses else "1=1"
            query = f"DELETE FROM {table_name} WHERE {where_clause}"
            affected_rows = self.db_manager.execute_update_delete(query, tuple(values))
            return affected_rows is not None and affected_rows > 0
        except Exception as e:
            self.logger.error("Failed to delete %s by condition: %s", model_class.__name__, e)
            return False

    def find_by_id(self, model_class: Type[BaseModel], record_id: int,
                   select_columns: List[str] = None,
                   ignore_columns: List[str] = None) -> Optional[BaseModel]:
        """Find a record by ID."""
        try:
            table_name = model_class().get_table_name()

            if select_columns:
                columns_str = ", ".join(select_columns)
            elif ignore_columns:
                all_columns = ['id', 'created_at', 'updated_at'] + list(model_class().get_schema().keys())
                filtered_columns = [col for col in all_columns if col not in ignore_columns]
                columns_str = ", ".join(filtered_columns) if filtered_columns else "*"
            else:
                columns_str = "*"

            query = f"SELECT {columns_str} FROM {table_name} WHERE id = %s"
            result = self.db_manager.execute_query_one(query, (record_id,))

            if result:
                return model_class.from_dict(dict(result))
            return None
        except Exception as e:
            self.logger.error("Failed to find %s with id %s: %s", model_class.__name__, record_id, e)
            return None

    def find_all(self, model_class: Type[BaseModel], limit: int = 500, offset: int = 0,
                 select_columns: List[str] = None,
                 ignore_columns: List[str] = None) -> List[BaseModel]:
        """Find all records (with pagination)."""
        try:
            table_name = model_class().get_table_name()

            if select_columns:
                columns_str = ", ".join(select_columns)
            elif ignore_columns:
                all_columns = ['id', 'created_at', 'updated_at'] + list(model_class().get_schema().keys())
                filtered_columns = [col for col in all_columns if col not in ignore_columns]
                columns_str = ", ".join(filtered_columns) if filtered_columns else "*"
            else:
                columns_str = "*"

            query = f"SELECT {columns_str} FROM {table_name} ORDER BY id DESC LIMIT %s OFFSET %s"
            results = self.db_manager.execute_query(query, (limit, offset))
            return [model_class.from_dict(dict(row)) for row in results] if results else []
        except Exception as e:
            self.logger.error("Failed to find all %s: %s", model_class.__name__, e)
            return []

    def find_by_condition(self, model_class: Type[BaseModel],
                          conditions: Dict[str, Any],
                          limit: int = 500,
                          offset: int = 0,
                          orderby: str = "id",
                          orderby_asc: bool = False,
                          return_list: bool = False,
                          select_columns: List[str] = None,
                          ignore_columns: List[str] = None) -> list:
        """Find records by condition."""
        def _do_find():
            table_name = model_class().get_table_name()

            if select_columns:
                columns_str = ", ".join(select_columns)
            elif ignore_columns:
                all_columns = ['id', 'created_at', 'updated_at'] + list(model_class().get_schema().keys())
                filtered_columns = [col for col in all_columns if col not in ignore_columns]
                columns_str = ", ".join(filtered_columns) if filtered_columns else "*"
            else:
                columns_str = "*"

            where_clauses = []
            values = []
            for key, value in conditions.items():
                self._build_where_clause(key, value, where_clauses, values)

            where_clause = " AND ".join(where_clauses) if where_clauses else "1=1"
            orderby_type = "ASC" if orderby_asc else "DESC"
            values.extend([limit, offset])

            query = (f"SELECT {columns_str} FROM {table_name} "
                     f"WHERE {where_clause} "
                     f"ORDER BY {orderby} {orderby_type} LIMIT %s OFFSET %s")

            results = self.db_manager.execute_query(query, tuple(values))

            if return_list:
                return [dict(row) for row in results] if results else []
            else:
                return [model_class.from_dict(dict(row)) for row in results] if results else []

        try:
            return self._with_auto_recovery(_do_find, "find_by_condition")
        except Exception as e:
            self.logger.error("Failed to find %s by condition: %s", model_class.__name__, e)
            return []

    def _build_where_clause(self, key: str, value: Any, where_clauses: List[str],
                            values: List[Any]):
        """WHERE clause condition builder helper."""
        placeholder = "%s"

        if key.endswith("__like__"):
            actual_key = key[:-8]
            where_clauses.append(f"{actual_key} LIKE {placeholder}")
            values.append(f"%{value}%")
        elif key.endswith("__notlike__"):
            actual_key = key[:-11]
            where_clauses.append(f"{actual_key} NOT LIKE {placeholder}")
            values.append(f"%{value}%")
        elif key.endswith("__not__"):
            actual_key = key[:-7]
            where_clauses.append(f"{actual_key} != {placeholder}")
            values.append(value)
        elif key.endswith("__gte__"):
            actual_key = key[:-7]
            where_clauses.append(f"{actual_key} >= {placeholder}")
            values.append(value)
        elif key.endswith("__lte__"):
            actual_key = key[:-7]
            where_clauses.append(f"{actual_key} <= {placeholder}")
            values.append(value)
        elif key.endswith("__gt__"):
            actual_key = key[:-6]
            where_clauses.append(f"{actual_key} > {placeholder}")
            values.append(value)
        elif key.endswith("__lt__"):
            actual_key = key[:-6]
            where_clauses.append(f"{actual_key} < {placeholder}")
            values.append(value)
        elif key.endswith("__in__"):
            actual_key = key[:-6]
            if isinstance(value, (list, tuple)) and len(value) > 0:
                placeholders = ", ".join([placeholder] * len(value))
                where_clauses.append(f"{actual_key} IN ({placeholders})")
                values.extend(value)
        elif key.endswith("__notin__"):
            actual_key = key[:-9]
            if isinstance(value, (list, tuple)) and len(value) > 0:
                placeholders = ", ".join([placeholder] * len(value))
                where_clauses.append(f"{actual_key} NOT IN ({placeholders})")
                values.extend(value)
        else:
            where_clauses.append(f"{key} = {placeholder}")
            values.append(value)

    def update_list_columns(self, model_class: Type[BaseModel],
                            updates: Dict[str, Any],
                            conditions: Dict[str, Any]) -> bool:
        """Update model with list columns."""
        try:
            table_name = model_class().get_table_name()

            set_clauses = []
            values = []
            for column, value in updates.items():
                if isinstance(value, list):
                    set_clauses.append(f"{column} = %s::text[]")
                elif isinstance(value, dict):
                    set_clauses.append(f"{column} = %s::jsonb")
                    value = json.dumps(value)
                else:
                    set_clauses.append(f"{column} = %s")
                values.append(value)

            where_clauses = []
            for key, value in conditions.items():
                where_clauses.append(f"{key} = %s")
                values.append(value)

            set_clause = ", ".join(set_clauses)
            where_clause = " AND ".join(where_clauses)

            query = f"UPDATE {table_name} SET {set_clause} WHERE {where_clause}"
            affected_rows = self.db_manager.execute_update_delete(query, tuple(values))
            return affected_rows is not None and affected_rows > 0
        except Exception as e:
            self.logger.error("Failed to update list columns for %s: %s", model_class.__name__, e)
            return False

    # ============================================================
    #  Lifecycle
    # ============================================================

    def close(self):
        """Close database connection."""
        self.db_manager.disconnect()
        self.logger.info("Application database connection closed")

    def run_migrations(self) -> bool:
        """Run database schema migrations."""
        try:
            return self.db_manager.run_migrations(self._models_registry)
        except Exception as e:
            self.logger.error("Failed to run migrations: %s", e)
            return False

    # ============================================================
    #  Table introspection
    # ============================================================

    def get_table_list(self) -> List[Dict[str, Any]]:
        """Get list of all tables in the database."""
        try:
            query = """
                SELECT table_name, table_type
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            """
            results = self.db_manager.execute_query(query)
            return results if results else []
        except Exception as e:
            self.logger.error("Failed to get table list: %s", e)
            return []

    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        """Get table schema."""
        try:
            query = """
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = %s
                ORDER BY ordinal_position
            """
            results = self.db_manager.execute_query(query, (table_name,))
            return results if results else []
        except Exception as e:
            self.logger.error("Failed to get table schema for %s: %s", table_name, e)
            return []

    def execute_raw_query(self, query: str, params: tuple = None) -> Dict[str, Any]:
        """Execute an arbitrary SQL query."""
        def _do_execute():
            query_stripped = query.strip().rstrip(';')
            results = self.db_manager.execute_query(query_stripped, params)
            if results is not None:
                return {
                    "success": True,
                    "error": None,
                    "data": results,
                    "row_count": len(results)
                }
            else:
                return {
                    "success": False,
                    "error": "Query execution returned None",
                    "data": []
                }

        try:
            return self._with_auto_recovery(_do_execute, "execute_raw_query")
        except Exception as e:
            self.logger.error("Failed to execute raw query: %s", e)
            return {"success": False, "error": str(e), "data": []}

    # ============================================================
    #  Table-name-based CRUD (for external / dynamic use)
    # ============================================================

    def insert_record(self, table_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert record by table name."""
        def _do_insert():
            serialized_data = self._serialize_data(data)
            columns = list(serialized_data.keys())
            values = list(serialized_data.values())
            placeholders = ", ".join(["%s"] * len(columns))
            query = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders}) RETURNING id"
            insert_id = self.db_manager.execute_insert(query, tuple(values))
            return {"success": True, "id": insert_id}

        try:
            return self._with_auto_recovery(_do_insert, "insert_record")
        except Exception as e:
            self.logger.error("Failed to insert record into %s: %s", table_name, e)
            return {"success": False, "id": None, "error": str(e)}

    def update_record(self, table_name: str, data: Dict[str, Any], record_id: int) -> Dict[str, Any]:
        """Update record by table name (ID-based)."""
        def _do_update():
            serialized_data = self._serialize_data(data)
            set_clause = ", ".join([f"{k} = %s" for k in serialized_data.keys()])
            query = f"UPDATE {table_name} SET {set_clause} WHERE id = %s"
            values = list(serialized_data.values()) + [record_id]
            affected_rows = self.db_manager.execute_update_delete(query, tuple(values))
            return {"success": True, "affected_rows": affected_rows or 0}

        try:
            return self._with_auto_recovery(_do_update, "update_record")
        except Exception as e:
            self.logger.error("Failed to update record in %s: %s", table_name, e)
            return {"success": False, "affected_rows": 0, "error": str(e)}

    def update_records_by_condition(self, table_name: str, updates: Dict[str, Any],
                                    conditions: Dict[str, Any]) -> Dict[str, Any]:
        """Update records by table name with conditions."""
        def _do_update():
            serialized_updates = self._serialize_data(updates)
            set_clause = ", ".join([f"{k} = %s" for k in serialized_updates.keys()])

            where_clauses = []
            where_values = []
            for key, value in conditions.items():
                self._build_where_clause(key, value, where_clauses, where_values)

            where_clause = " AND ".join(where_clauses) if where_clauses else "1=1"
            query = f"UPDATE {table_name} SET {set_clause} WHERE {where_clause}"
            values = list(serialized_updates.values()) + where_values
            affected_rows = self.db_manager.execute_update_delete(query, tuple(values))
            return {"success": True, "affected_rows": affected_rows or 0}

        try:
            return self._with_auto_recovery(_do_update, "update_records_by_condition")
        except Exception as e:
            self.logger.error("Failed to update records in %s: %s", table_name, e)
            return {"success": False, "affected_rows": 0, "error": str(e)}

    def delete_record(self, table_name: str, record_id: int) -> Dict[str, Any]:
        """Delete record by table name (ID-based)."""
        def _do_delete():
            query = f"DELETE FROM {table_name} WHERE id = %s"
            affected_rows = self.db_manager.execute_update_delete(query, (record_id,))
            return {"success": True, "affected_rows": affected_rows or 0}

        try:
            return self._with_auto_recovery(_do_delete, "delete_record")
        except Exception as e:
            self.logger.error("Failed to delete record from %s: %s", table_name, e)
            return {"success": False, "affected_rows": 0, "error": str(e)}

    def delete_records_by_condition(self, table_name: str, conditions: Dict[str, Any]) -> Dict[str, Any]:
        """Delete records by table name with conditions."""
        def _do_delete():
            where_clauses = []
            values = []
            for key, value in conditions.items():
                self._build_where_clause(key, value, where_clauses, values)

            where_clause = " AND ".join(where_clauses) if where_clauses else "1=1"
            query = f"DELETE FROM {table_name} WHERE {where_clause}"
            affected_rows = self.db_manager.execute_update_delete(query, tuple(values))
            return {"success": True, "affected_rows": affected_rows or 0}

        try:
            return self._with_auto_recovery(_do_delete, "delete_records_by_condition")
        except Exception as e:
            self.logger.error("Failed to delete records from %s: %s", table_name, e)
            return {"success": False, "affected_rows": 0, "error": str(e)}

    def find_record_by_id(self, table_name: str, record_id: int,
                          select_columns: List[str] = None) -> Dict[str, Any]:
        """Find record by table name and ID."""
        def _do_find():
            columns_str = ", ".join(select_columns) if select_columns else "*"
            query = f"SELECT {columns_str} FROM {table_name} WHERE id = %s"
            result = self.db_manager.execute_query_one(query, (record_id,))
            return {"success": True, "data": dict(result) if result else None}

        try:
            return self._with_auto_recovery(_do_find, "find_record_by_id")
        except Exception as e:
            self.logger.error("Failed to find record in %s: %s", table_name, e)
            return {"success": False, "data": None, "error": str(e)}

    def find_records(self, table_name: str, limit: int = 500, offset: int = 0,
                     select_columns: List[str] = None,
                     orderby: str = "id",
                     orderby_asc: bool = False) -> Dict[str, Any]:
        """Find all records by table name."""
        def _do_find():
            columns_str = ", ".join(select_columns) if select_columns else "*"
            orderby_type = "ASC" if orderby_asc else "DESC"
            query = (f"SELECT {columns_str} FROM {table_name} "
                     f"ORDER BY {orderby} {orderby_type} LIMIT %s OFFSET %s")
            results = self.db_manager.execute_query(query, (limit, offset))
            data = [dict(row) for row in results] if results else []
            return {"success": True, "data": data, "row_count": len(data)}

        try:
            return self._with_auto_recovery(_do_find, "find_records")
        except Exception as e:
            self.logger.error("Failed to find records in %s: %s", table_name, e)
            return {"success": False, "data": [], "row_count": 0, "error": str(e)}

    def find_records_by_condition(self, table_name: str, conditions: Dict[str, Any],
                                  limit: int = 500, offset: int = 0,
                                  orderby: str = "id",
                                  orderby_asc: bool = False,
                                  select_columns: List[str] = None) -> Dict[str, Any]:
        """Find records by table name with conditions."""
        def _do_find():
            columns_str = ", ".join(select_columns) if select_columns else "*"
            orderby_type = "ASC" if orderby_asc else "DESC"

            where_clauses = []
            values = []
            for key, value in conditions.items():
                self._build_where_clause(key, value, where_clauses, values)

            where_clause = " AND ".join(where_clauses) if where_clauses else "1=1"
            values.extend([limit, offset])

            query = (f"SELECT {columns_str} FROM {table_name} "
                     f"WHERE {where_clause} "
                     f"ORDER BY {orderby} {orderby_type} LIMIT %s OFFSET %s")

            results = self.db_manager.execute_query(query, tuple(values))
            data = [dict(row) for row in results] if results else []
            return {"success": True, "data": data, "row_count": len(data)}

        try:
            return self._with_auto_recovery(_do_find, "find_records_by_condition")
        except Exception as e:
            self.logger.error("Failed to find records in %s: %s", table_name, e)
            return {"success": False, "data": [], "row_count": 0, "error": str(e)}
