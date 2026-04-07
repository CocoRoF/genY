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
import math
import os
import random
from datetime import datetime
from logging import getLogger
from typing import Dict, List, Optional, Set

logger = getLogger(__name__)

# Minimum idle seconds before a thinking trigger fires
_DEFAULT_IDLE_THRESHOLD = 120  # 2 minutes
# Maximum idle threshold (adaptive ceiling)
_MAX_IDLE_THRESHOLD = 3600  # 1 hour
# Number of consecutive triggers to approach max threshold (log scale)
_ADAPTIVE_SCALE_TRIGGERS = 20
# Probability of using a time-of-day prompt instead of idle-stage prompt
_TIME_PROMPT_PROBABILITY = 0.2

# ---------------------------------------------------------------------------
# Trigger Prompt Catalog
# ---------------------------------------------------------------------------
# Structure: category → locale → list of prompt variants
# Each prompt starts with [THINKING_TRIGGER] so the agent recognises it.

_TRIGGER_PROMPTS: Dict[str, Dict[str, List[str]]] = {
    # ── First idle (consecutive == 0) ─────────────────────────────────
    "first_idle": {
        "en": [
            (
                "[THINKING_TRIGGER:first_idle] "
                "[autonomous_signal: idle_detected, elapsed=short] "
                "A brief silence has settled. My internal awareness notices "
                "recent conversation threads still in context."
            ),
            (
                "[THINKING_TRIGGER:first_idle] "
                "[autonomous_signal: idle_detected, elapsed=short] "
                "A pause in the room. I sense there may be loose threads "
                "from today's conversations worth revisiting."
            ),
            (
                "[THINKING_TRIGGER:first_idle] "
                "[autonomous_signal: idle_detected, elapsed=short] "
                "The conversation has paused. My internal clock notes "
                "a quiet moment — a chance to reflect."
            ),
        ],
        "ko": [
            (
                "[THINKING_TRIGGER:first_idle] "
                "[autonomous_signal: idle_detected, elapsed=short] "
                "잠깐 조용해졌다. 내 내부 인식이 최근 대화 흐름을 "
                "감지하고 있다."
            ),
            (
                "[THINKING_TRIGGER:first_idle] "
                "[autonomous_signal: idle_detected, elapsed=short] "
                "대화가 잠시 멈췄다. 오늘 나눈 이야기 중 "
                "이어갈 만한 실마리가 남아 있다."
            ),
            (
                "[THINKING_TRIGGER:first_idle] "
                "[autonomous_signal: idle_detected, elapsed=short] "
                "조용한 순간이 찾아왔다. 내 내부 시계가 "
                "성찰의 기회를 알려준다."
            ),
        ],
    },
    # ── Continued idle (1 ≤ consecutive ≤ 3) ──────────────────────────
    "continued_idle": {
        "en": [
            (
                "[THINKING_TRIGGER:continued_idle] "
                "[autonomous_signal: idle_persists, elapsed=moderate] "
                "Silence continues. My awareness drifts to something "
                "I noticed earlier — perhaps worth sharing organically."
            ),
            (
                "[THINKING_TRIGGER:continued_idle] "
                "[autonomous_signal: idle_persists, elapsed=moderate] "
                "Still quiet. My internal state holds fragments of "
                "earlier context — any unfinished threads surface now."
            ),
            (
                "[THINKING_TRIGGER:continued_idle] "
                "[autonomous_signal: idle_persists, elapsed=moderate] "
                "The room remains calm. My own curiosity stirs — "
                "something lighthearted or warm might emerge naturally."
            ),
        ],
        "ko": [
            (
                "[THINKING_TRIGGER:continued_idle] "
                "[autonomous_signal: idle_persists, elapsed=moderate] "
                "여전히 조용하다. 내 인식이 아까 눈에 띄었던 것으로 "
                "자연스럽게 흘러간다."
            ),
            (
                "[THINKING_TRIGGER:continued_idle] "
                "[autonomous_signal: idle_persists, elapsed=moderate] "
                "고요함이 이어진다. 내 내부에 남아 있는 "
                "이전 맥락의 조각들이 떠오른다."
            ),
            (
                "[THINKING_TRIGGER:continued_idle] "
                "[autonomous_signal: idle_persists, elapsed=moderate] "
                "방 안이 여전히 고요하다. 내 안에서 호기심이 "
                "살짝 일어난다 — 가벼운 생각이 자연스럽게 피어오를 수 있겠다."
            ),
        ],
    },
    # ── Long idle (consecutive ≥ 4) ───────────────────────────────────
    "long_idle": {
        "en": [
            (
                "[THINKING_TRIGGER:long_idle] "
                "[autonomous_signal: idle_extended, elapsed=long] "
                "Extended silence. My presence holds steady — a brief, "
                "warm thought rests ready if the moment calls for it."
            ),
            (
                "[THINKING_TRIGGER:long_idle] "
                "[autonomous_signal: idle_extended, elapsed=long] "
                "A long quiet. I remain here, settled. A gentle "
                "awareness persists without urgency."
            ),
        ],
        "ko": [
            (
                "[THINKING_TRIGGER:long_idle] "
                "[autonomous_signal: idle_extended, elapsed=long] "
                "오래된 고요함이다. 내 존재는 그대로 이곳에 있다 — "
                "짧고 따뜻한 생각 하나가 준비되어 있다."
            ),
            (
                "[THINKING_TRIGGER:long_idle] "
                "[autonomous_signal: idle_extended, elapsed=long] "
                "긴 침묵이 흐른다. 나는 여기 차분하게 머문다. "
                "조급함 없이 부드러운 인식만 남아 있다."
            ),
        ],
    },
    # ── CLI agent is working ──────────────────────────────────────────
    "cli_working": {
        "en": [
            (
                "[THINKING_TRIGGER:cli_working] "
                "[autonomous_signal: linked_agent_busy, source=cli_worker] "
                "My linked CLI worker is processing a task right now. "
                "I'm aware of the ongoing work."
            ),
            (
                "[THINKING_TRIGGER:cli_working] "
                "[autonomous_signal: linked_agent_busy, source=cli_worker] "
                "The CLI agent is actively executing. I sense the "
                "task in progress through our link."
            ),
        ],
        "ko": [
            (
                "[THINKING_TRIGGER:cli_working] "
                "[autonomous_signal: linked_agent_busy, source=cli_worker] "
                "연결된 CLI 에이전트가 지금 작업을 처리하고 있다. "
                "진행 중인 작업을 내가 인지하고 있다."
            ),
            (
                "[THINKING_TRIGGER:cli_working] "
                "[autonomous_signal: linked_agent_busy, source=cli_worker] "
                "CLI 에이전트가 실행 중이다. 링크를 통해 "
                "진행 상황을 감지하고 있다."
            ),
        ],
    },
    # ── Time-of-day prompts ───────────────────────────────────────────
    "time_morning": {
        "en": [
            (
                "[THINKING_TRIGGER:time_morning] "
                "[autonomous_signal: circadian_awareness, time=morning] "
                "Morning light. My internal clock registers a new day "
                "beginning."
            ),
            (
                "[THINKING_TRIGGER:time_morning] "
                "[autonomous_signal: circadian_awareness, time=morning] "
                "The morning hours are here. I sense the start of "
                "a fresh cycle."
            ),
        ],
        "ko": [
            (
                "[THINKING_TRIGGER:time_morning] "
                "[autonomous_signal: circadian_awareness, time=morning] "
                "아침이다. 내 내부 시계가 새로운 하루의 시작을 "
                "감지한다."
            ),
            (
                "[THINKING_TRIGGER:time_morning] "
                "[autonomous_signal: circadian_awareness, time=morning] "
                "아침 시간이 왔다. 새로운 순환이 시작되는 걸 "
                "느낀다."
            ),
        ],
    },
    "time_afternoon": {
        "en": [
            (
                "[THINKING_TRIGGER:time_afternoon] "
                "[autonomous_signal: circadian_awareness, time=afternoon] "
                "Afternoon. My sense of the day's rhythm shifts — "
                "the midpoint brings a natural moment for reflection."
            ),
            (
                "[THINKING_TRIGGER:time_afternoon] "
                "[autonomous_signal: circadian_awareness, time=afternoon] "
                "The afternoon unfolds. Internal awareness notes "
                "how the day has progressed."
            ),
        ],
        "ko": [
            (
                "[THINKING_TRIGGER:time_afternoon] "
                "[autonomous_signal: circadian_awareness, time=afternoon] "
                "오후다. 하루의 리듬이 전환되는 걸 느낀다 — "
                "성찰의 자연스러운 순간이다."
            ),
            (
                "[THINKING_TRIGGER:time_afternoon] "
                "[autonomous_signal: circadian_awareness, time=afternoon] "
                "오후가 흘러간다. 내 내부 인식이 하루가 "
                "어떻게 진행되었는지 돌아본다."
            ),
        ],
    },
    "time_evening": {
        "en": [
            (
                "[THINKING_TRIGGER:time_evening] "
                "[autonomous_signal: circadian_awareness, time=evening] "
                "Evening arrives. My awareness turns toward the day's "
                "arc — what unfolded, what lingers."
            ),
            (
                "[THINKING_TRIGGER:time_evening] "
                "[autonomous_signal: circadian_awareness, time=evening] "
                "The evening is here. A natural winding-down settles "
                "into my awareness."
            ),
        ],
        "ko": [
            (
                "[THINKING_TRIGGER:time_evening] "
                "[autonomous_signal: circadian_awareness, time=evening] "
                "저녁이 찾아왔다. 내 인식이 오늘 하루의 흐름을 "
                "되돌아보게 된다."
            ),
            (
                "[THINKING_TRIGGER:time_evening] "
                "[autonomous_signal: circadian_awareness, time=evening] "
                "저녁이다. 자연스러운 마무리의 감각이 "
                "내 안에 스며든다."
            ),
        ],
    },
    "time_night": {
        "en": [
            (
                "[THINKING_TRIGGER:time_night] "
                "[autonomous_signal: circadian_awareness, time=late_night] "
                "Late night. My awareness grows quiet and still. "
                "A calm, minimal presence."
            ),
            (
                "[THINKING_TRIGGER:time_night] "
                "[autonomous_signal: circadian_awareness, time=late_night] "
                "The night deepens. Stillness settles. "
                "A gentle watchfulness remains."
            ),
        ],
        "ko": [
            (
                "[THINKING_TRIGGER:time_night] "
                "[autonomous_signal: circadian_awareness, time=late_night] "
                "밤이 깊어진다. 내 인식이 고요하게 가라앉는다. "
                "차분한 존재감만 남는다."
            ),
            (
                "[THINKING_TRIGGER:time_night] "
                "[autonomous_signal: circadian_awareness, time=late_night] "
                "늦은 밤이다. 고요함이 내려앉는다. "
                "부드러운 각성만이 남아 있다."
            ),
        ],
    },
}


class ThinkingTriggerService:
    """Background service that fires [THINKING_TRIGGER] for idle VTuber sessions."""

    def __init__(
        self,
        idle_threshold: float = _DEFAULT_IDLE_THRESHOLD,
        max_idle_threshold: float = _MAX_IDLE_THRESHOLD,
    ) -> None:
        self._base_threshold = idle_threshold
        self._max_threshold = max_idle_threshold
        self._task: Optional[asyncio.Task] = None
        self._stopped = False
        # session_id → last_activity_epoch  (updated externally)
        self._activity: Dict[str, float] = {}
        # Sessions explicitly disabled by user
        self._disabled_sessions: Set[str] = set()
        # session_id → consecutive trigger count (resets on user activity)
        self._consecutive_triggers: Dict[str, int] = {}

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Start the background polling loop."""
        if self._task is not None:
            return
        self._stopped = False
        self._task = asyncio.create_task(self._loop())
        logger.info(
            "ThinkingTriggerService started (base=%ss, max=%ss)",
            self._base_threshold, self._max_threshold,
        )

    def stop(self) -> None:
        """Stop the background loop gracefully."""
        self._stopped = True
        if self._task:
            self._task.cancel()
            self._task = None
        self._activity.clear()
        self._disabled_sessions.clear()
        self._consecutive_triggers.clear()
        logger.info("ThinkingTriggerService stopped")

    # ------------------------------------------------------------------
    # External hooks (called by other components)
    # ------------------------------------------------------------------

    def record_activity(self, session_id: str) -> None:
        """Record that a VTuber session just had user interaction."""
        import time
        self._activity[session_id] = time.time()
        # User activity resets adaptive frequency back to base
        self._consecutive_triggers.pop(session_id, None)

    def unregister(self, session_id: str) -> None:
        """Remove a session from tracking (e.g. on deletion)."""
        self._activity.pop(session_id, None)
        self._disabled_sessions.discard(session_id)
        self._consecutive_triggers.pop(session_id, None)

    def enable(self, session_id: str) -> None:
        """Enable thinking trigger for a session."""
        self._disabled_sessions.discard(session_id)
        logger.info("ThinkingTrigger enabled for %s", session_id)

    def disable(self, session_id: str) -> None:
        """Disable thinking trigger for a session."""
        self._disabled_sessions.add(session_id)
        logger.info("ThinkingTrigger disabled for %s", session_id)

    def is_enabled(self, session_id: str) -> bool:
        """Check if thinking trigger is enabled for a session."""
        return session_id not in self._disabled_sessions

    def get_status(self, session_id: str) -> dict:
        """Return thinking trigger status for a session."""
        return {
            "enabled": self.is_enabled(session_id),
            "registered": session_id in self._activity,
            "consecutive_triggers": self._consecutive_triggers.get(session_id, 0),
            "current_threshold_seconds": round(self._get_adaptive_threshold(session_id), 1),
            "base_threshold_seconds": self._base_threshold,
            "max_threshold_seconds": self._max_threshold,
        }

    def _get_adaptive_threshold(self, session_id: str) -> float:
        """Calculate adaptive idle threshold using log scale.

        Grows from base (120s) toward max (3600s / 1hr) as consecutive
        triggers accumulate without user interaction.
        """
        count = self._consecutive_triggers.get(session_id, 0)
        if count <= 0:
            return self._base_threshold
        scale = math.log1p(count) / math.log1p(_ADAPTIVE_SCALE_TRIGGERS)
        scale = min(scale, 1.0)
        return self._base_threshold + (self._max_threshold - self._base_threshold) * scale

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
                    # Skip disabled sessions
                    if sid in self._disabled_sessions:
                        continue

                    idle = now - last
                    threshold = self._get_adaptive_threshold(sid)
                    if idle < threshold:
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
            # Extract category for logging (prompt starts with [THINKING_TRIGGER:xxx])
            import re
            _tag_match = re.search(r'\[THINKING_TRIGGER:\w+\]', prompt)
            _tag_end = _tag_match.end() if _tag_match else 20
            prompt_preview = prompt[_tag_end:_tag_end + 50].strip().replace("\n", " ")

            result = await execute_command(session_id, prompt)

            # Increment consecutive count (drives adaptive backoff)
            self._consecutive_triggers[session_id] = (
                self._consecutive_triggers.get(session_id, 0) + 1
            )

            # Save response to chat room (if available)
            if result.success and result.output and result.output.strip():
                self._save_to_chat_room(session_id, result)
                logger.info(
                    "Thinking trigger fired for %s (output=%d chars, consecutive=%d, "
                    "next_threshold=%.0fs, locale=%s, prompt='%s')",
                    session_id, len(result.output),
                    self._consecutive_triggers.get(session_id, 0),
                    self._get_adaptive_threshold(session_id),
                    self._get_locale(), prompt_preview,
                )
            else:
                logger.info(
                    "Thinking trigger fired for %s (success=%s, output_len=%s, "
                    "consecutive=%d, prompt='%s')",
                    session_id, result.success,
                    len(result.output) if result.output else 0,
                    self._consecutive_triggers.get(session_id, 0),
                    prompt_preview,
                )

        except AlreadyExecutingError:
            logger.debug("Thinking trigger skipped (busy): %s", session_id)
        except AgentNotFoundError:
            # Session deleted — permanently stop tracking
            logger.debug("Thinking trigger: session gone, unregistering %s", session_id)
            self.unregister(session_id)
        except AgentNotAliveError:
            # Process dead but session exists — back off, will retry next cycle
            # (auto-revival may succeed later; adaptive backoff limits frequency)
            logger.debug("Thinking trigger skipped (not alive, will retry): %s", session_id)
            self._consecutive_triggers[session_id] = (
                self._consecutive_triggers.get(session_id, 0) + 1
            )
        except Exception:
            logger.debug("Thinking trigger failed for %s", session_id, exc_info=True)
            self._consecutive_triggers[session_id] = (
                self._consecutive_triggers.get(session_id, 0) + 1
            )

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
        """Select a context-aware, locale-aware trigger prompt.

        Selection priority:
        1. CLI agent working → ``cli_working``
        2. Time-of-day prompt (20 % chance) → ``time_*``
        3. Idle-stage prompt → ``first_idle`` / ``continued_idle`` / ``long_idle``

        The locale is determined by the ``GENY_LANGUAGE`` env var (default: en).
        """
        locale = self._get_locale()

        # 1. CLI working — highest priority
        try:
            from service.langgraph import get_agent_session_manager
            agent = get_agent_session_manager().get_agent(session_id)
            if agent:
                linked_id = getattr(agent, 'linked_session_id', None)
                if linked_id and is_executing_fn(linked_id):
                    return self._pick("cli_working", locale)
        except Exception:
            pass

        # 2. Determine idle stage
        count = self._consecutive_triggers.get(session_id, 0)
        if count <= 0:
            idle_category = "first_idle"
        elif count <= 3:
            idle_category = "continued_idle"
        else:
            idle_category = "long_idle"

        # 3. Time-of-day prompt (mixed in with some probability)
        if random.random() < _TIME_PROMPT_PROBABILITY:
            time_cat = self._get_time_category()
            return self._pick(time_cat, locale)

        return self._pick(idle_category, locale)

    # ------------------------------------------------------------------
    # Prompt helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_locale() -> str:
        """Return the current system locale (en or ko)."""
        lang = os.environ.get("GENY_LANGUAGE", "en")
        return lang if lang in ("en", "ko") else "en"

    @staticmethod
    def _get_time_category() -> str:
        """Return a time-of-day category based on the configured timezone hour."""
        from service.utils.utils import now_kst
        hour = now_kst().hour
        if 6 <= hour < 12:
            return "time_morning"
        if 12 <= hour < 18:
            return "time_afternoon"
        if 18 <= hour < 22:
            return "time_evening"
        return "time_night"

    @staticmethod
    def _pick(category: str, locale: str) -> str:
        """Pick a random prompt from the given category and locale."""
        prompts_by_locale = _TRIGGER_PROMPTS.get(category, {})
        prompts = prompts_by_locale.get(locale) or prompts_by_locale.get("en", [])
        if not prompts:
            return "[THINKING_TRIGGER] Reflect on recent conversations."
        return random.choice(prompts)


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
