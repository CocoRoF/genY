"""
Chat Room Model — Database model for chat room metadata.

Each chat room groups multiple agent sessions for broadcast messaging.
"""
from typing import Dict, Any
from service.database.models.base_model import BaseModel


class ChatRoomModel(BaseModel):
    """Model for storing chat room metadata."""

    def __init__(
        self,
        room_id: str = "",
        name: str = "",
        session_ids: str = "[]",   # JSON array stored as text
        message_count: int = 0,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.room_id = room_id
        self.name = name
        self.session_ids = session_ids  # JSON-encoded list of session IDs
        self.message_count = message_count

    def get_table_name(self) -> str:
        return "chat_rooms"

    def get_schema(self) -> Dict[str, str]:
        return {
            "room_id": "VARCHAR(255) NOT NULL",
            "name": "VARCHAR(500) DEFAULT ''",
            "session_ids": "TEXT DEFAULT '[]'",
            "message_count": "INTEGER DEFAULT 0",
        }

    @classmethod
    def get_create_table_query(cls, db_type: str = "postgresql") -> str:
        """Generate CREATE TABLE query — includes UNIQUE constraint on room_id."""
        base_query = super().get_create_table_query(db_type)
        constraint = ",\n            UNIQUE (room_id)"
        idx = base_query.rfind(")")
        if idx != -1:
            return base_query[:idx] + constraint + base_query[idx:]
        return base_query

    def get_indexes(self) -> list:
        return [
            ("idx_chat_rooms_room_id", "room_id"),
        ]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChatRoomModel":
        known_fields = {
            "room_id", "name", "session_ids", "message_count",
            "id", "created_at", "updated_at",
        }
        known_data = {k: v for k, v in data.items() if k in known_fields}
        return cls(**known_data)

    def __repr__(self):
        return (
            f"ChatRoomModel(id={self.id}, room_id='{self.room_id}', "
            f"name='{self.name}', message_count={self.message_count})"
        )
