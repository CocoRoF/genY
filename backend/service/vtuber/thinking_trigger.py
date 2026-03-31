"""
Thinking Trigger Service
========================

Manages when the VTuber should initiate self-driven thinking —
idle reflections, scheduled check-ins, or event-driven observations.

The service runs a lightweight background loop that periodically
checks whether any VTuber session should fire a [THINKING_TRIGGER].
"""

from __future__ import annotations

import asyncio
import random
from logging import getLogger
from typing import Dict, Optional

logger = getLogger(__name__)

# Minimum idle seconds before a thinking trigger fires
_DEFAULT_IDLE_THRESHOLD = 120  # 2 minutes

# Varied trigger prompts for more natural behavior
_TRIGGER_PROMPTS = [
    (
        "[THINKING_TRIGGER] You've been idle for a while. "
        "Reflect on recent conversations, recall interesting "
        "topics, or think about what the user might need next."
    ),
    (
        "[THINKING_TRIGGER] 잠깐 여유가 생겼네. "
        "최근 대화를 돌아보거나, 사용자에게 도움이 될 만한 걸 떠올려 봐."
    ),
    (
        "[THINKING_TRIGGER] 조용한 시간이야. "
        "재미있는 관찰이나 팁을 공유하고 싶다면 지금이 좋은 타이밍이야."
    ),
    (
        "[THINKING_TRIGGER] 사용자가 잠깐 자리를 비운 것 같아. "
        "다시 돌아왔을 때 반갑게 맞이할 준비를 해 두자."
    ),
]

_CLI_AWARE_PROMPT = (
    "[THINKING_TRIGGER] CLI 에이전트가 지금 작업 중이야. "
    "작업이 끝나면 결과를 정리해서 사용자에게 알려줘야 해. "
    "그동안 준비하면서 기다려 봐."
)


class ThinkingTriggerService:
    """Background service that fires [THINKING_TRIGGER] for idle VTuber sessions."""

    def __init__(self, idle_threshold: float = _DEFAULT_IDLE_THRESHOLD) -> None:
        self._idle_threshold = idle_threshold
        self._task: Optional[asyncio.Task] = None
        self._stopped = False
        # session_id → last_activity_epoch  (updated externally)
        self._activity: Dict[str, float] = {}

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Start the background polling loop."""
        if self._task is not None:
            return
        self._stopped = False
        self._task = asyncio.create_task(self._loop())
        logger.info("ThinkingTriggerService started (idle=%ss)", self._idle_threshold)

    def stop(self) -> None:
        """Stop the background loop gracefully."""
        self._stopped = True
        if self._task:
            self._task.cancel()
            self._task = None
        self._activity.clear()
        logger.info("ThinkingTriggerService stopped")

    # ------------------------------------------------------------------
    # External hooks (called by other components)
    # ------------------------------------------------------------------

    def record_activity(self, session_id: str) -> None:
        """Record that a VTuber session just had user interaction."""
        import time
        self._activity[session_id] = time.time()

    def unregister(self, session_id: str) -> None:
        """Remove a session from tracking (e.g. on deletion)."""
        self._activity.pop(session_id, None)

    # ------------------------------------------------------------------
    # Background loop
    # ------------------------------------------------------------------

    async def _loop(self) -> None:
        """Poll every 30s and fire triggers for idle VTuber sessions."""
        import time

        while not self._stopped:
            try:
                await asyncio.sleep(30)
                now = time.time()

                for sid, last in list(self._activity.items()):
                    idle = now - last
                    if idle < self._idle_threshold:
                        continue

                    # Fire a thinking trigger
                    await self._fire_trigger(sid)
                    # Reset to avoid immediate re-fire
                    self._activity[sid] = now

            except asyncio.CancelledError:
                break
            except Exception:
                logger.debug("ThinkingTrigger loop error", exc_info=True)

    async def _fire_trigger(self, session_id: str) -> None:
        """Send a context-aware [THINKING_TRIGGER] to the VTuber session.

        If the session has a chat_room_id, the response is also saved
        to the chat room so it appears in the VTuber chat panel in real-time.
        """
        try:
            from service.execution.agent_executor import (
                AlreadyExecutingError,
                AgentNotAliveError,
                AgentNotFoundError,
                execute_command,
                is_executing,
            )

            # Check if the linked CLI worker is busy
            prompt = self._build_trigger_prompt(session_id, is_executing)

            result = await execute_command(session_id, prompt)

            # Save response to chat room (if available)
            if result.success and result.output and result.output.strip():
                self._save_to_chat_room(session_id, result)
                logger.info(
                    "Thinking trigger fired for %s (output=%d chars, saved to chat)",
                    session_id, len(result.output),
                )
            else:
                logger.info(
                    "Thinking trigger fired for %s (success=%s, output_len=%s, not saved)",
                    session_id, result.success,
                    len(result.output) if result.output else 0,
                )

        except AlreadyExecutingError:
            logger.debug("Thinking trigger skipped (busy): %s", session_id)
        except (AgentNotFoundError, AgentNotAliveError):
            logger.debug("Thinking trigger skipped (not alive): %s", session_id)
            self.unregister(session_id)
        except Exception:
            logger.debug("Thinking trigger failed for %s", session_id, exc_info=True)
            self.unregister(session_id)

    def _save_to_chat_room(self, session_id: str, result) -> None:
        """Persist the trigger response to the session's chat room.

        Also notifies SSE listeners so the VTuber chat panel updates live.
        """
        try:
            from service.langgraph import get_agent_session_manager
            agent = get_agent_session_manager().get_agent(session_id)
            if not agent:
                logger.warning("[ThinkingTrigger] No agent found for %s, skipping chat save", session_id)
                return

            chat_room_id = getattr(agent, '_chat_room_id', None)
            if not chat_room_id:
                logger.warning("[ThinkingTrigger] No chat_room_id on agent %s, skipping chat save", session_id)
                return

            from service.chat.conversation_store import get_chat_store
            store = get_chat_store()

            session_name = getattr(agent, '_session_name', None) or session_id
            role_val = getattr(agent, '_role', None)
            role = role_val.value if hasattr(role_val, 'value') else str(role_val or 'vtuber')

            msg = store.add_message(chat_room_id, {
                "type": "agent",
                "content": result.output.strip(),
                "session_id": session_id,
                "session_name": session_name,
                "role": role,
                "duration_ms": result.duration_ms,
                "cost_usd": result.cost_usd,
            })

            logger.info(
                "[ThinkingTrigger] Saved response to chat room %s (msg_id=%s, len=%d)",
                chat_room_id, msg.get("id", "?"), len(result.output),
            )

            # Notify SSE listeners
            try:
                from controller.chat_controller import _notify_room
                _notify_room(chat_room_id)
            except Exception:
                logger.warning("[ThinkingTrigger] _notify_room failed for %s", chat_room_id, exc_info=True)

        except Exception:
            logger.warning("[ThinkingTrigger] Failed to save trigger response to chat room", exc_info=True)

    def _build_trigger_prompt(self, session_id: str, is_executing_fn) -> str:
        """Select a trigger prompt based on context."""
        # If CLI agent is currently executing, use CLI-aware prompt
        try:
            from service.langgraph import get_agent_session_manager
            agent = get_agent_session_manager().get_agent(session_id)
            if agent:
                linked_id = getattr(agent, 'linked_session_id', None)
                if linked_id and is_executing_fn(linked_id):
                    return _CLI_AWARE_PROMPT
        except Exception:
            pass

        return random.choice(_TRIGGER_PROMPTS)


# ============================================================================
# Module-level singleton
# ============================================================================

_instance: Optional[ThinkingTriggerService] = None


def get_thinking_trigger_service() -> ThinkingTriggerService:
    """Get or create the singleton ThinkingTriggerService."""
    global _instance
    if _instance is None:
        _instance = ThinkingTriggerService()
    return _instance
