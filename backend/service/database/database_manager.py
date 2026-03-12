"""
psycopg3-based database connection and connection pool management

Key features:
- Connection pool management using ConnectionPool
- Automatic idle connection cleanup (max_idle)
- Connection lifetime management (max_lifetime)
- Dead connection detection and disposal (check callback)
- Automatic reconnection (reconnect_timeout)
- Retry decorator (exponential backoff)
- Schema migration (ALTER TABLE ADD COLUMN)
"""
import os
import logging
import threading
import time
import functools
from typing import Optional, Dict, Any, Callable, TypeVar, List
from contextlib import contextmanager
from zoneinfo import ZoneInfo

logger = logging.getLogger("database-manager")

T = TypeVar('T')

TIMEZONE = ZoneInfo(os.getenv('TIMEZONE', 'Asia/Seoul'))

# Retry configuration
DEFAULT_MAX_RETRIES = int(os.getenv('DB_MAX_RETRIES', '3'))
DEFAULT_RETRY_DELAY = float(os.getenv('DB_RETRY_DELAY', '1.0'))
DEFAULT_RETRY_BACKOFF = float(os.getenv('DB_RETRY_BACKOFF', '2.0'))


def with_retry(max_retries: int = DEFAULT_MAX_RETRIES,
               delay: float = DEFAULT_RETRY_DELAY,
               backoff: float = DEFAULT_RETRY_BACKOFF,
               exceptions: tuple = None):
    """
    Retry decorator — retries with exponential backoff on connection-related exceptions
    """
    if exceptions is None:
        # lazy import to handle when psycopg is not yet installed
        try:
            from psycopg import OperationalError, InterfaceError
            exceptions = (OperationalError, InterfaceError, ConnectionError, TimeoutError)
        except ImportError:
            exceptions = (ConnectionError, TimeoutError)

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(self, *args, **kwargs) -> T:
            last_exception = None
            current_delay = delay

            for attempt in range(max_retries + 1):
                try:
                    if attempt > 0 and hasattr(self, '_ensure_pool_healthy'):
                        self._ensure_pool_healthy()
                    return func(self, *args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        self.logger.warning(
                            f"{func.__name__} failed (attempt {attempt + 1}/{max_retries + 1}): {e}. "
                            f"Retrying in {current_delay:.1f}s..."
                        )
                        time.sleep(current_delay)
                        current_delay *= backoff
                        if hasattr(self, '_try_recover_connection'):
                            self._try_recover_connection()
                    else:
                        self.logger.error(
                            f"{func.__name__} failed after {max_retries + 1} attempts: {e}"
                        )
            raise last_exception
        return wrapper
    return decorator


class DatabaseManager:
    """
    psycopg3-based database connection and connection pool management

    Connection pool key parameters:
    - min_size / max_size: Pool size range
    - max_idle: Idle connection retention time (seconds)
    - max_lifetime: Maximum connection lifetime (seconds)
    - reconnect_timeout: Maximum reconnection attempt time (seconds)
    - timeout: Connection acquisition wait time (seconds)
    """

    DEFAULT_MIN_SIZE = int(os.getenv('DB_POOL_MIN_SIZE', '2'))
    DEFAULT_MAX_SIZE = int(os.getenv('DB_POOL_MAX_SIZE', '10'))
    DEFAULT_MAX_IDLE = float(os.getenv('DB_POOL_MAX_IDLE', '300'))
    DEFAULT_MAX_LIFETIME = float(os.getenv('DB_POOL_MAX_LIFETIME', '1800'))
    DEFAULT_RECONNECT_TIMEOUT = float(os.getenv('DB_POOL_RECONNECT_TIMEOUT', '300'))
    DEFAULT_TIMEOUT = float(os.getenv('DB_POOL_TIMEOUT', '30'))

    def __init__(
        self,
        database_config=None,
        min_size: int = None,
        max_size: int = None,
        max_idle: float = None,
        max_lifetime: float = None,
        reconnect_timeout: float = None,
        timeout: float = None
    ):
        # If database_config is None, automatically use the singleton instance
        if database_config is None:
            from service.database.database_config import database_config as _default_config
            database_config = _default_config
        self.config = database_config
        self.db_type = "postgresql"
        self.logger = logger

        self.min_size = min_size or self.DEFAULT_MIN_SIZE
        self.max_size = max_size or self.DEFAULT_MAX_SIZE
        self.max_idle = max_idle or self.DEFAULT_MAX_IDLE
        self.max_lifetime = max_lifetime or self.DEFAULT_MAX_LIFETIME
        self.reconnect_timeout = reconnect_timeout or self.DEFAULT_RECONNECT_TIMEOUT
        self.timeout = timeout or self.DEFAULT_TIMEOUT

        self._pool = None
        self._pool_lock = threading.Lock()

        # Pool statistics
        self._stats = {
            'connections_created': 0,
            'connections_closed': 0,
            'connections_failed': 0,
            'health_checks_passed': 0,
            'health_checks_failed': 0,
            'reconnect_attempts': 0,
            'auto_recoveries': 0,
            'retry_successes': 0,
        }

        # Recovery state
        self._recovering = False
        self._recovery_lock = threading.Lock()
        self._last_health_check = 0
        self._health_check_interval = float(os.getenv('DB_HEALTH_CHECK_INTERVAL', '30'))

    def _build_conninfo(self) -> str:
        """Build PostgreSQL connection string."""
        host = self.config.POSTGRES_HOST.value
        port = self.config.POSTGRES_PORT.value
        database = self.config.POSTGRES_DB.value
        user = self.config.POSTGRES_USER.value
        password = self.config.POSTGRES_PASSWORD.value
        return f"host={host} port={port} dbname={database} user={user} password={password}"

    def _configure_connection(self, conn) -> None:
        """Connection initialization callback."""
        import psycopg
        try:
            timezone_str = str(TIMEZONE)
            conn.execute(f"SET timezone = '{timezone_str}'")
            if conn.info.transaction_status != psycopg.pq.TransactionStatus.IDLE:
                conn.commit()
            self._stats['connections_created'] += 1
        except Exception as e:
            self.logger.error(f"Failed to configure connection: {e}")
            try:
                import psycopg
                if conn.info.transaction_status != psycopg.pq.TransactionStatus.IDLE:
                    conn.rollback()
            except Exception:
                pass
            raise

    def _check_connection(self, conn) -> None:
        """Connection validity check callback."""
        import psycopg
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
            if conn.info.transaction_status != psycopg.pq.TransactionStatus.IDLE:
                conn.rollback()
            self._stats['health_checks_passed'] += 1
        except Exception as e:
            self._stats['health_checks_failed'] += 1
            self.logger.warning(f"Connection check failed: {e}")
            raise

    def _reset_connection(self, conn) -> None:
        """Connection reset callback."""
        import psycopg
        try:
            if conn.info.transaction_status != psycopg.pq.TransactionStatus.IDLE:
                conn.rollback()
        except Exception as e:
            self.logger.warning(f"Failed to reset connection: {e}")
            raise

    def _on_reconnect_failed(self, pool) -> None:
        """Reconnection failure callback."""
        self._stats['reconnect_attempts'] += 1
        self.logger.error(
            f"Pool failed to reconnect after {self.reconnect_timeout} seconds. "
            "Will continue attempting..."
        )

    def connect(self) -> bool:
        """Connect to database (initialize connection pool)."""
        try:
            return self._connect_postgresql_pool()
        except Exception as e:
            self.logger.error(f"Failed to connect to database: {e}")
            self._stats['connections_failed'] += 1
            return False

    def _connect_postgresql_pool(self) -> bool:
        """Create and initialize PostgreSQL ConnectionPool."""
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool

        try:
            with self._pool_lock:
                if self._pool is not None:
                    self.logger.warning("Pool already exists, closing old pool...")
                    try:
                        self._pool.close()
                    except Exception as e:
                        self.logger.warning(f"Error closing old pool: {e}")

                conninfo = self._build_conninfo()

                self._pool = ConnectionPool(
                    conninfo=conninfo,
                    min_size=self.min_size,
                    max_size=self.max_size,
                    max_idle=self.max_idle,
                    max_lifetime=self.max_lifetime,
                    timeout=self.timeout,
                    reconnect_timeout=self.reconnect_timeout,
                    num_workers=3,
                    configure=self._configure_connection,
                    check=self._check_connection,
                    reset=self._reset_connection,
                    reconnect_failed=self._on_reconnect_failed,
                    kwargs={"row_factory": dict_row},
                    open=True,
                    name="geny-db-pool"
                )

                self._pool.wait(timeout=self.timeout)

                self.logger.info(
                    f"PostgreSQL connection pool initialized: "
                    f"min_size={self.min_size}, max_size={self.max_size}, "
                    f"max_idle={self.max_idle}s, max_lifetime={self.max_lifetime}s"
                )
                return True

        except Exception as e:
            self.logger.error(f"Failed to create PostgreSQL connection pool: {e}")
            self._stats['connections_failed'] += 1
            return False

    def reconnect(self) -> bool:
        """Reconnect to database."""
        try:
            self.logger.info("Attempting database reconnection...")
            self._stats['reconnect_attempts'] += 1

            with self._pool_lock:
                if self._pool:
                    self._pool.drain()
                    self.logger.info("PostgreSQL pool drained and refreshed")
                    return True
                else:
                    return self._connect_postgresql_pool()
        except Exception as e:
            self.logger.error(f"Failed to reconnect database: {e}")
            return False

    def health_check(self, auto_recover: bool = True) -> bool:
        """Check database connection status."""
        try:
            if not self._is_pool_healthy():
                if auto_recover:
                    self.logger.warning("Pool unhealthy during health check, attempting recovery...")
                    if not self._try_recover_connection():
                        self._stats['health_checks_failed'] += 1
                        return False
                else:
                    self._stats['health_checks_failed'] += 1
                    return False

            with self._pool.connection(timeout=5.0) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    result = cur.fetchone()
                    if result is not None:
                        self._stats['health_checks_passed'] += 1
                        self._last_health_check = time.time()
                        return True
                    return False
        except Exception as e:
            self.logger.error(f"Health check failed: {e}")
            self._stats['health_checks_failed'] += 1
            if auto_recover:
                if self._try_recover_connection():
                    return self.health_check(auto_recover=False)
            return False

    def _is_pool_healthy(self) -> bool:
        """Check if the pool is in a healthy state."""
        if not self._pool:
            return False
        try:
            if hasattr(self._pool, 'closed') and self._pool.closed:
                return False
            if hasattr(self._pool, '_closed') and self._pool._closed:
                return False
            return True
        except Exception as e:
            self.logger.warning(f"Pool health check error: {e}")
            return False

    def _ensure_pool_healthy(self) -> bool:
        """Check if the pool is healthy and recover if necessary."""
        if self._is_pool_healthy():
            return True
        self.logger.warning("Pool is not healthy, attempting recovery...")
        return self._try_recover_connection()

    def _try_recover_connection(self) -> bool:
        """Attempt connection recovery."""
        with self._recovery_lock:
            if self._recovering:
                time.sleep(0.5)
                return self._is_pool_healthy()
            self._recovering = True

        try:
            self.logger.info("Starting connection recovery...")
            self._stats['auto_recoveries'] += 1

            with self._pool_lock:
                if self._pool:
                    try:
                        self._pool.close()
                    except Exception as e:
                        self.logger.warning(f"Error closing old pool during recovery: {e}")
                    finally:
                        self._pool = None

            success = self._connect_postgresql_pool()
            if success:
                self.logger.info("Connection recovery successful")
                self._stats['retry_successes'] += 1
            return success
        except Exception as e:
            self.logger.error(f"Connection recovery failed: {e}")
            return False
        finally:
            with self._recovery_lock:
                self._recovering = False

    @contextmanager
    def get_connection(self, timeout: float = None, auto_recover: bool = True):
        """Context manager for acquiring a connection."""
        from psycopg import OperationalError, InterfaceError

        if not self._is_pool_healthy():
            if auto_recover:
                if not self._try_recover_connection():
                    raise RuntimeError("Connection pool not available and recovery failed")
            else:
                raise RuntimeError("Connection pool not initialized")

        effective_timeout = timeout or self.timeout

        try:
            with self._pool.connection(timeout=effective_timeout) as conn:
                yield conn
        except (OperationalError, InterfaceError) as e:
            if auto_recover:
                self.logger.warning(f"Connection error, attempting recovery: {e}")
                if self._try_recover_connection():
                    with self._pool.connection(timeout=effective_timeout) as conn:
                        yield conn
                else:
                    raise
            else:
                raise

    def disconnect(self):
        """Disconnect from database."""
        with self._pool_lock:
            if self._pool:
                try:
                    self._pool.close()
                    self._stats['connections_closed'] += 1
                    self.logger.info("PostgreSQL connection pool closed")
                except Exception as e:
                    self.logger.warning(f"Error closing pool: {e}")
                finally:
                    self._pool = None

    def get_pool_stats(self) -> Dict[str, Any]:
        """Return pool status statistics."""
        stats = self._stats.copy()
        if self._pool:
            try:
                pool_stats = self._pool.get_stats()
                stats.update({
                    'pool_min_size': self.min_size,
                    'pool_max_size': self.max_size,
                    'pool_size': pool_stats.get('pool_size', 0),
                    'pool_available': pool_stats.get('pool_available', 0),
                    'requests_waiting': pool_stats.get('requests_waiting', 0),
                })
            except Exception as e:
                self.logger.warning(f"Failed to get pool stats: {e}")
        return stats

    def check_and_refresh_pool(self) -> bool:
        """Check pool status and refresh if necessary."""
        if not self._pool:
            return True
        try:
            self._pool.check()
            return True
        except Exception as e:
            self.logger.error(f"Pool check failed: {e}")
            return False

    # ============================================================
    #  Query execution methods
    # ============================================================

    def _execute_with_retry(self, operation: Callable[[], T], operation_name: str = "operation") -> T:
        """Execution wrapper with retry logic."""
        from psycopg import OperationalError, InterfaceError

        last_exception = None
        current_delay = DEFAULT_RETRY_DELAY

        for attempt in range(DEFAULT_MAX_RETRIES + 1):
            try:
                if attempt > 0:
                    self._ensure_pool_healthy()
                return operation()
            except Exception as e:
                last_exception = e
                is_retryable = isinstance(e, (OperationalError, InterfaceError, ConnectionError, TimeoutError))
                if is_retryable and attempt < DEFAULT_MAX_RETRIES:
                    self.logger.warning(
                        f"{operation_name} failed (attempt {attempt + 1}/{DEFAULT_MAX_RETRIES + 1}): {e}. "
                        f"Retrying in {current_delay:.1f}s..."
                    )
                    time.sleep(current_delay)
                    current_delay *= DEFAULT_RETRY_BACKOFF
                    self._try_recover_connection()
                else:
                    raise
        raise last_exception

    def execute_query(self, query: str, params: tuple = None) -> Optional[list]:
        """Execute query — with automatic retry."""
        def _do_execute():
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    if params:
                        cur.execute(query, params)
                    else:
                        cur.execute(query)

                    if query.strip().upper().startswith('SELECT'):
                        result = cur.fetchall()
                        return list(result) if result else []
                    else:
                        conn.commit()
                        return []
            return []

        try:
            return self._execute_with_retry(_do_execute, "execute_query")
        except Exception as e:
            self.logger.error(f"Query execution failed after retries: {e}")
            return None

    def execute_query_one(self, query: str, params: tuple = None) -> Optional[Dict]:
        """Execute query and return a single result."""
        result = self.execute_query(query, params)
        if result and len(result) > 0:
            return result[0]
        return None

    def execute_insert(self, query: str, params: tuple = None) -> Optional[int]:
        """Execute INSERT query and return the generated ID."""
        def _do_insert():
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    if params:
                        cur.execute(query, params)
                    else:
                        cur.execute(query)
                    result = cur.fetchone()
                    conn.commit()
                    if result:
                        if isinstance(result, dict):
                            return result.get("id")
                        elif hasattr(result, '__getitem__'):
                            return result[0]
                    return None
            return None

        try:
            return self._execute_with_retry(_do_insert, "execute_insert")
        except Exception as e:
            self.logger.error(f"Insert query execution failed after retries: {e}")
            return None

    def execute_update_delete(self, query: str, params: tuple = None) -> Optional[int]:
        """Execute UPDATE/DELETE query and return the number of affected rows."""
        def _do_update_delete():
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    if params:
                        cur.execute(query, params)
                    else:
                        cur.execute(query)
                    affected_rows = cur.rowcount
                    conn.commit()
                    return affected_rows
            return None

        try:
            return self._execute_with_retry(_do_update_delete, "execute_update_delete")
        except Exception as e:
            self.logger.error(f"Update/Delete query execution failed after retries: {e}")
            return None

    def table_exists(self, table_name: str) -> bool:
        """Check if a table exists."""
        query = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = %s
            );
        """
        result = self.execute_query(query, (table_name,))
        return bool(result)

    # ============================================================
    #  Migration methods
    # ============================================================

    def run_migrations(self, models_registry=None) -> bool:
        """Run database migrations."""
        try:
            self.logger.info("Running migrations...")

            if models_registry:
                if not self._run_schema_migrations(models_registry):
                    self.logger.error("Schema migrations failed")
                    return False

            self.logger.info("All migrations completed successfully")
            return True
        except Exception as e:
            self.logger.error(f"Migration failed: {e}")
            return False

    def _run_schema_migrations(self, models_registry) -> bool:
        """Detect schema changes and run migrations."""
        try:
            self.logger.info("Running schema migrations...")

            for model_class in models_registry:
                table_name = model_class().get_table_name()
                expected_schema = model_class().get_schema()
                current_columns = self._get_table_columns(table_name)

                if not current_columns:
                    self.logger.warning(f"Table {table_name} does not exist or has no columns")
                    continue

                missing_columns = []
                for column_name, column_def in expected_schema.items():
                    if column_name not in current_columns:
                        missing_columns.append((column_name, column_def))
                        self.logger.info(f"Found missing column: {table_name}.{column_name} ({column_def})")

                for column_name, column_def in missing_columns:
                    if not self._add_column_to_table(table_name, column_name, column_def):
                        return False

                if not missing_columns:
                    self.logger.info(f"Table {table_name} schema is up to date")

            return True
        except Exception as e:
            self.logger.error(f"Schema migration failed: {e}")
            return False

    def _get_table_columns(self, table_name: str) -> dict:
        """Query the current column structure of a table."""
        try:
            query = """
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = %s
                ORDER BY ordinal_position
            """
            result = self.execute_query(query, (table_name,))
            if result:
                return {row['column_name']: row['data_type'] for row in result}
            return {}
        except Exception as e:
            self.logger.error(f"Failed to get table columns for {table_name}: {e}")
            return {}

    def _add_column_to_table(self, table_name: str, column_name: str, column_def: str) -> bool:
        """Add a column to a table."""
        try:
            self.logger.info(f"Adding missing column {column_name} to table {table_name}")
            alter_query = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column_name} {column_def}"
            self.execute_query(alter_query)
            self.logger.info(f"Successfully added column {column_name} to {table_name}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to add column {column_name} to {table_name}: {e}")
            return False


# ============================================================
#  Singleton
# ============================================================
_db_manager = None
_db_manager_lock = threading.Lock()


def get_database_manager(database_config=None) -> DatabaseManager:
    """Return the database manager singleton instance."""
    global _db_manager
    with _db_manager_lock:
        if _db_manager is None or database_config is not None:
            _db_manager = DatabaseManager(database_config)
        return _db_manager


def reset_database_manager():
    """Reset the database manager singleton."""
    global _db_manager
    with _db_manager_lock:
        if _db_manager:
            _db_manager.disconnect()
        _db_manager = None
