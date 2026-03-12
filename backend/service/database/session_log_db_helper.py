"""
Session Log DB Helper — Read/write session log entries from/to PostgreSQL.

Provides DB-backed persistence for session log entries produced by
SessionLogger.  Used by SessionLogger when DB is available.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, TYPE_CHECKING

if TYPE_CHECKING:
    from service.database.app_database_manager import AppDatabaseManager

logger = logging.getLogger("session-log-db-helper")

TABLE = "session_logs"


def _get_db_manager(db_manager):
    """Extract the actual DatabaseManager instance."""
    if db_manager is None:
        return None
    if hasattr(db_manager, "db_manager"):
        return db_manager.db_manager
    return db_manager


def _is_db_available(db_manager) -> bool:
    """Check if the DB connection is available."""
    actual = _get_db_manager(db_manager)
    if actual is None:
        return False
    if hasattr(actual, "_is_pool_healthy"):
        return actual._is_pool_healthy()
    return False


# ======================================================================
#  Write
# ======================================================================

def db_insert_log_entry(
    db_manager,
    session_id: str,
    level: str,
    message: str,
    metadata: Optional[Dict[str, Any]] = None,
    log_timestamp: str = "",
) -> bool:
    """Insert a single log entry into the session_logs table.

    Args:
        db_manager: AppDatabaseManager or DatabaseManager.
        session_id: Session ID.
        level: Log level string (e.g. "INFO", "COMMAND").
        message: Log message text.
        metadata: Optional metadata dict (stored as JSON text).
        log_timestamp: ISO timestamp string.

    Returns:
        True if successful, False otherwise.
    """
    mgr = _get_db_manager(db_manager)
    if not _is_db_available(db_manager):
        return False

    try:
        meta_str = json.dumps(metadata, ensure_ascii=False, default=str) if metadata else "{}"
        query = (
            f"INSERT INTO {TABLE} (session_id, level, message, metadata_json, log_timestamp) "
            f"VALUES (%s, %s, %s, %s, %s) "
            f"RETURNING id"
        )
        mgr.execute_insert(query, (session_id, level, message, meta_str, log_timestamp))
        return True
    except Exception as e:
        logger.debug(f"Failed to insert log entry for {session_id}: {e}")
        return False


def db_insert_log_entries_batch(
    db_manager,
    entries: List[Dict[str, Any]],
) -> int:
    """Insert multiple log entries in a batch.

    Each entry dict should have: session_id, level, message, metadata_json, log_timestamp.

    Returns:
        Number of entries successfully inserted.
    """
    mgr = _get_db_manager(db_manager)
    if not _is_db_available(db_manager):
        return 0

    count = 0
    for entry in entries:
        try:
            query = (
                f"INSERT INTO {TABLE} (session_id, level, message, metadata_json, log_timestamp) "
                f"VALUES (%s, %s, %s, %s, %s) "
                f"RETURNING id"
            )
            mgr.execute_insert(query, (
                entry.get("session_id", ""),
                entry.get("level", "INFO"),
                entry.get("message", ""),
                entry.get("metadata_json", "{}"),
                entry.get("log_timestamp", ""),
            ))
            count += 1
        except Exception as e:
            logger.debug(f"Failed to insert batch log entry: {e}")
    return count


# ======================================================================
#  Read
# ======================================================================

def db_get_session_logs(
    db_manager,
    session_id: str,
    limit: int = 100,
    level_filter: Optional[Set[str]] = None,
) -> Optional[List[Dict[str, Any]]]:
    """Get log entries for a session.

    Args:
        db_manager: AppDatabaseManager or DatabaseManager.
        session_id: Session ID.
        limit: Max entries to return.
        level_filter: Optional set of level strings to filter by.

    Returns:
        List of log entry dicts, or None on failure.
    """
    mgr = _get_db_manager(db_manager)
    if not _is_db_available(db_manager):
        return None

    try:
        if level_filter:
            placeholders = ", ".join(["%s"] * len(level_filter))
            query = (
                f"SELECT session_id, level, message, metadata_json, log_timestamp "
                f"FROM {TABLE} "
                f"WHERE session_id = %s AND level IN ({placeholders}) "
                f"ORDER BY id DESC LIMIT %s"
            )
            params = (session_id, *level_filter, limit)
        else:
            query = (
                f"SELECT session_id, level, message, metadata_json, log_timestamp "
                f"FROM {TABLE} "
                f"WHERE session_id = %s "
                f"ORDER BY id DESC LIMIT %s"
            )
            params = (session_id, limit)

        rows = mgr.execute_query(query, params)
        if rows is None:
            return None

        entries = []
        for row in reversed(rows):  # Reverse to get chronological order
            metadata = {}
            meta_str = row.get("metadata_json", "{}")
            if meta_str:
                try:
                    metadata = json.loads(meta_str)
                except (json.JSONDecodeError, TypeError):
                    pass
            entries.append({
                "timestamp": row.get("log_timestamp", ""),
                "level": row.get("level", "INFO"),
                "message": row.get("message", ""),
                "metadata": metadata,
            })
        return entries
    except Exception as e:
        logger.debug(f"Failed to read logs for {session_id}: {e}")
        return None


def db_list_session_log_summaries(db_manager) -> Optional[List[Dict[str, Any]]]:
    """List all sessions that have log entries, with summary info.

    Returns:
        List of dicts with session_id, entry_count, last_timestamp, or None on failure.
    """
    mgr = _get_db_manager(db_manager)
    if not _is_db_available(db_manager):
        return None

    try:
        query = (
            f"SELECT session_id, COUNT(*) as entry_count, MAX(log_timestamp) as last_ts "
            f"FROM {TABLE} GROUP BY session_id ORDER BY last_ts DESC"
        )
        rows = mgr.execute_query(query)
        if rows is None:
            return None

        return [
            {
                "session_id": row.get("session_id", ""),
                "entry_count": row.get("entry_count", 0),
                "last_timestamp": row.get("last_ts", ""),
            }
            for row in rows
        ]
    except Exception as e:
        logger.debug(f"Failed to list session log summaries: {e}")
        return None


def db_session_has_logs(db_manager, session_id: str) -> bool:
    """Check if a session has any log entries in DB."""
    mgr = _get_db_manager(db_manager)
    if not _is_db_available(db_manager):
        return False

    try:
        query = f"SELECT 1 FROM {TABLE} WHERE session_id = %s LIMIT 1"
        result = mgr.execute_query_one(query, (session_id,))
        return result is not None
    except Exception:
        return False


def db_delete_session_logs(db_manager, session_id: str) -> bool:
    """Delete all log entries for a session.

    Returns True if successful.
    """
    mgr = _get_db_manager(db_manager)
    if not _is_db_available(db_manager):
        return False

    try:
        query = f"DELETE FROM {TABLE} WHERE session_id = %s"
        mgr.execute_update_delete(query, (session_id,))
        return True
    except Exception as e:
        logger.debug(f"Failed to delete logs for {session_id}: {e}")
        return False


# ======================================================================
#  Migration
# ======================================================================

def db_migrate_logs_from_file(
    db_manager,
    session_id: str,
    entries: List[Dict[str, Any]],
) -> int:
    """Migrate parsed log entries from a .log file into DB.

    Args:
        db_manager: AppDatabaseManager or DatabaseManager.
        session_id: Session ID.
        entries: List of parsed log entry dicts (timestamp, level, message, metadata).

    Returns:
        Number of entries migrated.
    """
    mgr = _get_db_manager(db_manager)
    if not _is_db_available(db_manager):
        return 0

    # Skip if session already has entries in DB
    if db_session_has_logs(db_manager, session_id):
        return 0

    batch = []
    for entry in entries:
        meta = entry.get("metadata", {})
        batch.append({
            "session_id": session_id,
            "level": entry.get("level", "INFO"),
            "message": entry.get("message", ""),
            "metadata_json": json.dumps(meta, ensure_ascii=False, default=str) if meta else "{}",
            "log_timestamp": entry.get("timestamp", ""),
        })

    return db_insert_log_entries_batch(db_manager, batch)
