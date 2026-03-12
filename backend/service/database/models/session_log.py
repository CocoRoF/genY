"""
Session Log Model — Database model for per-session log entries.

Stores every log entry produced by SessionLogger so that logs survive
container restarts and can be queried without reading .log files.
"""
from typing import Dict, Any
from service.database.models.base_model import BaseModel


class SessionLogModel(BaseModel):
    """Model for storing individual session log entries."""

    def __init__(
        self,
        session_id: str = "",
        level: str = "INFO",
        message: str = "",
        metadata_json: str = "{}",
        log_timestamp: str = "",
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.session_id = session_id
        self.level = level
        self.message = message
        self.metadata_json = metadata_json
        self.log_timestamp = log_timestamp

    def get_table_name(self) -> str:
        return "session_logs"

    def get_schema(self) -> Dict[str, str]:
        return {
            "session_id": "VARCHAR(255) NOT NULL",
            "level": "VARCHAR(20) NOT NULL DEFAULT 'INFO'",
            "message": "TEXT DEFAULT ''",
            "metadata_json": "TEXT DEFAULT '{}'",
            "log_timestamp": "VARCHAR(100) DEFAULT ''",
        }

    def get_indexes(self) -> list:
        return [
            ("idx_session_logs_session_id", "session_id"),
            ("idx_session_logs_level", "level"),
            ("idx_session_logs_ts", "log_timestamp"),
            ("idx_session_logs_session_level", "session_id, level"),
        ]
