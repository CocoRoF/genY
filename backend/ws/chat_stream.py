"""
WebSocket endpoint for real-time chat room event streaming.

Replaces the GET /api/chat/rooms/{room_id}/events SSE endpoint
with a persistent WebSocket connection that pushes new messages,
broadcast status, and agent progress in real time.

Protocol:
  Client -> {"type": "subscribe", "after": "msg_id_or_null"}
  Client -> {"type": "ping"}

  Server -> {"type": "message", "data": {...}}
  Server -> {"type": "broadcast_status", "data": {...}}
  Server -> {"type": "agent_progress", "data": {...}}
  Server -> {"type": "broadcast_done", "data": {...}}
  Server -> {"type": "heartbeat", "data": {"ts": ...}}
  Server -> {"type": "error", "data": {"error": "..."}}
"""

from __future__ import annotations

import asyncio
import json
import time
from logging import getLogger
from typing import Any, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = getLogger(__name__)

router = APIRouter()


def _sanitize(obj: Any) -> Any:
    """Recursively ensure all values are JSON-serializable."""
    if obj is None or isinstance(obj, (bool, int, float, str)):
        return obj
    if isinstance(obj, dict):
        return {str(k): _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return str(obj)


async def _send_event(ws: WebSocket, event_type: str, data: Any, room_id: str = "") -> bool:
    """Send a JSON event over WebSocket. Returns False if connection lost."""
    try:
        await ws.send_json({"type": event_type, "data": _sanitize(data)})
        if event_type != "heartbeat":
            logger.debug(
                "[ChatWS:%s] sent event=%s data_keys=%s",
                room_id[:8] if room_id else "?",
                event_type,
                list(data.keys()) if isinstance(data, dict) else type(data).__name__,
            )
        return True
    except Exception as exc:
        logger.warning(
            "[ChatWS:%s] failed to send event=%s: %s",
            room_id[:8] if room_id else "?",
            event_type,
            exc,
        )
        return False


def _get_messages_after(store, room_id: str, after_id: Optional[str]) -> List[dict]:
    """Return messages in the room that come after the given message ID."""
    all_msgs = store.get_messages(room_id)
    if not after_id:
        return []

    idx = -1
    for i, m in enumerate(all_msgs):
        if m.get("id") == after_id:
            idx = i
            break

    if idx < 0:
        logger.debug(
            "[ChatWS:%s] after_id=%s not found in %d messages - returning all",
            room_id[:8], after_id[:8] if after_id else "null", len(all_msgs),
        )
        return all_msgs
    result = all_msgs[idx + 1 :]
    if result:
        logger.debug(
            "[ChatWS:%s] %d new messages after %s",
            room_id[:8], len(result), after_id[:8],
        )
    return result


@router.websocket("/ws/chat/rooms/{room_id}")
async def ws_chat_room_stream(websocket: WebSocket, room_id: str):
    """
    WebSocket endpoint for real-time chat room events.

    After connection, client sends a subscribe message to begin receiving events:
      {"type": "subscribe", "after": "last_seen_msg_id_or_null"}

    Server pushes events in real time: message, broadcast_status,
    agent_progress, broadcast_done, heartbeat.
    """
    logger.info("[ChatWS:%s] WebSocket connection attempt", room_id[:8])
    await websocket.accept()
    logger.info("[ChatWS:%s] WebSocket accepted", room_id[:8])

    from service.chat.conversation_store import get_chat_store
    from controller.chat_controller import (
        _active_broadcasts,
        _get_room_event,
        _build_agent_progress_data,
    )
    from service.config.sub_config.general.chat_config import ChatConfig

    store = get_chat_store()
    room = store.get_room(room_id)
    if not room:
        logger.warning("[ChatWS:%s] Room not found, closing", room_id[:8])
        await _send_event(websocket, "error", {"error": f"Room not found: {room_id}"}, room_id)
        await websocket.close()
        return

    logger.info(
        "[ChatWS:%s] Room found: name=%s, sessions=%d",
        room_id[:8], room.get("name", "?"), len(room.get("session_ids", [])),
    )

    try:
        while True:
            raw = await websocket.receive_text()
            logger.debug("[ChatWS:%s] received raw: %s", room_id[:8], raw[:200])
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("[ChatWS:%s] invalid JSON from client: %s", room_id[:8], raw[:100])
                await _send_event(websocket, "error", {"error": "Invalid JSON"}, room_id)
                continue

            msg_type = msg.get("type", "")

            if msg_type == "subscribe":
                last_seen_id = msg.get("after")
                logger.info(
                    "[ChatWS:%s] subscribe request, after=%s",
                    room_id[:8], last_seen_id[:8] if last_seen_id else "null",
                )
                await _stream_room_events(
                    websocket, store, room_id, last_seen_id,
                    _active_broadcasts, _get_room_event, _build_agent_progress_data,
                )
                logger.info("[ChatWS:%s] _stream_room_events returned (client disconnected or unsubscribed)", room_id[:8])

            elif msg_type == "ping":
                await _send_event(websocket, "pong", {"ts": time.time()}, room_id)

            else:
                logger.warning("[ChatWS:%s] unknown message type: %s", room_id[:8], msg_type)
                await _send_event(
                    websocket, "error", {"error": f"Unknown message type: {msg_type}"}, room_id,
                )

    except WebSocketDisconnect:
        logger.info("[ChatWS:%s] WebSocket disconnected", room_id[:8])
    except Exception as e:
        logger.error(
            "[ChatWS:%s] WebSocket error: %s", room_id[:8], e, exc_info=True
        )
        try:
            await _send_event(websocket, "error", {"error": str(e)}, room_id)
        except Exception:
            pass


async def _stream_room_events(
    ws: WebSocket,
    store,
    room_id: str,
    last_seen_id: Optional[str],
    active_broadcasts: dict,
    get_room_event,
    build_agent_progress_data,
) -> None:
    """
    Push room events over WebSocket until the client disconnects.

    Mirrors the SSE event_generator in chat_controller.py but uses
    WebSocket push instead of SSE yield.
    """
    from service.config.sub_config.general.chat_config import ChatConfig

    _chat_cfg = ChatConfig.get_default_instance()
    heartbeat_interval = float(_chat_cfg.sse_heartbeat_interval_s)
    room_event = get_room_event(room_id)
    loop_count = 0

    logger.info(
        "[ChatWS:%s] _stream_room_events started, last_seen_id=%s, heartbeat=%ss",
        room_id[:8],
        last_seen_id[:8] if last_seen_id else "null",
        heartbeat_interval,
    )

    # On initial subscribe: send any messages newer than after
    if last_seen_id:
        missed = _get_messages_after(store, room_id, last_seen_id)
        logger.info("[ChatWS:%s] sending %d missed messages", room_id[:8], len(missed))
        for m in missed:
            if not await _send_event(ws, "message", m, room_id):
                logger.warning("[ChatWS:%s] connection lost while sending missed messages", room_id[:8])
                return
            last_seen_id = m["id"]
    else:
        all_msgs = store.get_messages(room_id)
        if all_msgs:
            last_seen_id = all_msgs[-1]["id"]
            logger.debug(
                "[ChatWS:%s] no after_id, anchoring to latest msg=%s (total=%d)",
                room_id[:8], last_seen_id[:8], len(all_msgs),
            )

    # Send current broadcast status if active
    bstate = active_broadcasts.get(room_id)
    if bstate and not bstate.finished:
        logger.info(
            "[ChatWS:%s] active broadcast found: id=%s, total=%d, completed=%d, responded=%d",
            room_id[:8], bstate.broadcast_id[:8], bstate.total, bstate.completed, bstate.responded,
        )
        await _send_event(ws, "broadcast_status", {
            "broadcast_id": bstate.broadcast_id,
            "total": bstate.total,
            "completed": bstate.completed,
            "responded": bstate.responded,
            "finished": False,
        }, room_id)
        if bstate.agent_states:
            agent_progress_list = [
                build_agent_progress_data(astate)
                for astate in bstate.agent_states.values()
            ]
            await _send_event(ws, "agent_progress", {
                "broadcast_id": bstate.broadcast_id,
                "agents": agent_progress_list,
            }, room_id)
    else:
        logger.debug("[ChatWS:%s] no active broadcast on subscribe", room_id[:8])

    # Main loop: wait for new messages or heartbeat
    while True:
        room_event.clear()
        loop_count += 1

        try:
            # Use asyncio.wait to handle both room events and incoming WS messages
            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(room_event.wait()),
                    asyncio.create_task(_ws_receive_or_timeout(ws, heartbeat_interval)),
                ],
                return_when=asyncio.FIRST_COMPLETED,
            )

            # Check if we received a client message (e.g., unsubscribe)
            for task in done:
                result = task.result()
                if isinstance(result, dict):
                    logger.debug("[ChatWS:%s] client message in stream loop: %s", room_id[:8], result)
                    if result.get("type") == "unsubscribe":
                        logger.info("[ChatWS:%s] client unsubscribed", room_id[:8])
                        return
            # Cancel pending tasks
            for task in pending:
                task.cancel()

        except asyncio.CancelledError:
            logger.info("[ChatWS:%s] stream cancelled", room_id[:8])
            return

        # Check for new messages
        if last_seen_id is not None:
            new_msgs = _get_messages_after(store, room_id, last_seen_id)
        else:
            new_msgs = store.get_messages(room_id)

        if new_msgs:
            logger.debug(
                "[ChatWS:%s] loop=%d: %d new messages to send",
                room_id[:8], loop_count, len(new_msgs),
            )

        for m in new_msgs:
            if not await _send_event(ws, "message", m, room_id):
                logger.warning("[ChatWS:%s] connection lost while sending new messages", room_id[:8])
                return
            last_seen_id = m["id"]

        # Broadcast status update
        bstate = active_broadcasts.get(room_id)
        if bstate:
            await _send_event(ws, "broadcast_status", {
                "broadcast_id": bstate.broadcast_id,
                "total": bstate.total,
                "completed": bstate.completed,
                "responded": bstate.responded,
                "finished": bstate.finished,
            }, room_id)

            if not bstate.finished and bstate.agent_states:
                agent_progress_list = [
                    build_agent_progress_data(astate)
                    for astate in bstate.agent_states.values()
                ]
                await _send_event(ws, "agent_progress", {
                    "broadcast_id": bstate.broadcast_id,
                    "agents": agent_progress_list,
                }, room_id)

            if bstate.finished:
                logger.info(
                    "[ChatWS:%s] broadcast %s finished, sending broadcast_done",
                    room_id[:8], bstate.broadcast_id[:8],
                )
                await _send_event(ws, "broadcast_done", {
                    "broadcast_id": bstate.broadcast_id,
                    "total": bstate.total,
                    "responded": bstate.responded,
                }, room_id)
        elif not new_msgs:
            # No active broadcast, no new messages - just heartbeat
            await _send_event(ws, "heartbeat", {"ts": time.time()}, room_id)


async def _ws_receive_or_timeout(ws: WebSocket, timeout: float) -> Optional[dict]:
    """
    Try to receive a WebSocket message within timeout.
    Returns the parsed message dict, or None on timeout.
    """
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=timeout)
        return json.loads(raw)
    except asyncio.TimeoutError:
        return None
    except (json.JSONDecodeError, WebSocketDisconnect):
        return None
