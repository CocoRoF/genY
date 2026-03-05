"""
Chat Conversation Store — Persistent chat room and message storage.

Storage layout::

    backend/chat_conversations/
        rooms.json            — Room registry (list of all rooms)
        {room_id}.json        — Individual room message history

Public API::

    store = ChatConversationStore()
    room  = store.create_room(name, session_ids)
    rooms = store.list_rooms()
    room  = store.get_room(room_id)
    store.delete_room(room_id)
    store.add_message(room_id, message_dict)
    msgs  = store.get_messages(room_id)
    store.update_room_sessions(room_id, session_ids)
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from logging import getLogger
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional

logger = getLogger(__name__)

# Storage directory — next to the backend root
_STORE_DIR = Path(__file__).parent.parent / "chat_conversations"


class ChatConversationStore:
    """Thread-safe persistent chat room and message store."""

    def __init__(self, store_dir: Optional[Path] = None) -> None:
        self._dir = store_dir or _STORE_DIR
        self._dir.mkdir(parents=True, exist_ok=True)
        self._rooms_path = self._dir / "rooms.json"
        self._lock = Lock()
        self._rooms: List[Dict[str, Any]] = []
        self._load_rooms()

    # ── Room Registry ──

    def _load_rooms(self) -> None:
        """Load rooms.json from disk."""
        if self._rooms_path.is_file():
            try:
                with open(self._rooms_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, list):
                    self._rooms = data
                else:
                    logger.warning("rooms.json has invalid format — starting fresh")
                    self._rooms = []
            except Exception as e:
                logger.error(f"Failed to load rooms.json: {e}")
                self._rooms = []
        else:
            self._rooms = []

    def _save_rooms(self) -> None:
        """Write rooms to disk (must hold _lock)."""
        try:
            with open(self._rooms_path, "w", encoding="utf-8") as f:
                json.dump(self._rooms, f, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            logger.error(f"Failed to save rooms.json: {e}")

    def list_rooms(self) -> List[Dict[str, Any]]:
        """Return all rooms sorted by last activity (newest first)."""
        with self._lock:
            return sorted(
                self._rooms,
                key=lambda r: r.get("updated_at", r.get("created_at", "")),
                reverse=True,
            )

    def get_room(self, room_id: str) -> Optional[Dict[str, Any]]:
        """Get a single room by ID."""
        with self._lock:
            for r in self._rooms:
                if r["id"] == room_id:
                    return r
            return None

    def create_room(
        self,
        name: str,
        session_ids: List[str],
    ) -> Dict[str, Any]:
        """Create a new chat room with given sessions."""
        now = datetime.now(timezone.utc).isoformat()
        room = {
            "id": str(uuid.uuid4()),
            "name": name,
            "session_ids": session_ids,
            "created_at": now,
            "updated_at": now,
            "message_count": 0,
        }
        with self._lock:
            self._rooms.append(room)
            self._save_rooms()

        # Create empty messages file
        self._save_messages(room["id"], [])

        logger.info(f"Chat room created: {room['id']} ({name}) with {len(session_ids)} sessions")
        return room

    def update_room_sessions(
        self, room_id: str, session_ids: List[str]
    ) -> Optional[Dict[str, Any]]:
        """Update the session list for a room."""
        with self._lock:
            for r in self._rooms:
                if r["id"] == room_id:
                    r["session_ids"] = session_ids
                    r["updated_at"] = datetime.now(timezone.utc).isoformat()
                    self._save_rooms()
                    return r
            return None

    def update_room_name(
        self, room_id: str, name: str
    ) -> Optional[Dict[str, Any]]:
        """Rename a room."""
        with self._lock:
            for r in self._rooms:
                if r["id"] == room_id:
                    r["name"] = name
                    r["updated_at"] = datetime.now(timezone.utc).isoformat()
                    self._save_rooms()
                    return r
            return None

    def delete_room(self, room_id: str) -> bool:
        """Delete a room and its message history."""
        with self._lock:
            original_len = len(self._rooms)
            self._rooms = [r for r in self._rooms if r["id"] != room_id]
            if len(self._rooms) < original_len:
                self._save_rooms()
                # Delete message file
                msg_path = self._dir / f"{room_id}.json"
                if msg_path.is_file():
                    msg_path.unlink()
                logger.info(f"Chat room deleted: {room_id}")
                return True
            return False

    # ── Messages ──

    def _messages_path(self, room_id: str) -> Path:
        return self._dir / f"{room_id}.json"

    def _load_messages(self, room_id: str) -> List[Dict[str, Any]]:
        path = self._messages_path(room_id)
        if path.is_file():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return data if isinstance(data, list) else []
            except Exception as e:
                logger.error(f"Failed to load messages for room {room_id}: {e}")
                return []
        return []

    def _save_messages(self, room_id: str, messages: List[Dict[str, Any]]) -> None:
        try:
            with open(self._messages_path(room_id), "w", encoding="utf-8") as f:
                json.dump(messages, f, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            logger.error(f"Failed to save messages for room {room_id}: {e}")

    def get_messages(self, room_id: str) -> List[Dict[str, Any]]:
        """Load all messages for a room."""
        with self._lock:
            return self._load_messages(room_id)

    def add_message(self, room_id: str, message: Dict[str, Any]) -> Dict[str, Any]:
        """Append a message to a room's history and update room metadata."""
        with self._lock:
            messages = self._load_messages(room_id)
            # Ensure message has an id and timestamp
            if "id" not in message:
                message["id"] = str(uuid.uuid4())
            if "timestamp" not in message:
                message["timestamp"] = datetime.now(timezone.utc).isoformat()
            messages.append(message)
            self._save_messages(room_id, messages)

            # Update room metadata
            for r in self._rooms:
                if r["id"] == room_id:
                    r["updated_at"] = message["timestamp"]
                    r["message_count"] = len(messages)
                    break
            self._save_rooms()

        return message

    def add_messages_batch(
        self, room_id: str, messages_to_add: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Append multiple messages at once (for broadcast results)."""
        with self._lock:
            messages = self._load_messages(room_id)
            now = datetime.now(timezone.utc).isoformat()
            for msg in messages_to_add:
                if "id" not in msg:
                    msg["id"] = str(uuid.uuid4())
                if "timestamp" not in msg:
                    msg["timestamp"] = now
                messages.append(msg)
            self._save_messages(room_id, messages)

            # Update room metadata
            for r in self._rooms:
                if r["id"] == room_id:
                    r["updated_at"] = now
                    r["message_count"] = len(messages)
                    break
            self._save_rooms()

        return messages_to_add


# ── Singleton ──

_store_instance: Optional[ChatConversationStore] = None


def get_chat_store() -> ChatConversationStore:
    """Get or create the singleton ChatConversationStore."""
    global _store_instance
    if _store_instance is None:
        _store_instance = ChatConversationStore()
    return _store_instance
