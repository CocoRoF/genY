"""
VTuber Delegate Node — routes a task to the paired CLI Agent via DM.

Uses the inbox + auto-trigger mechanism to send the task,
then returns a conversational acknowledgment to the user.
"""

from __future__ import annotations

import asyncio
import random
import uuid
from logging import getLogger
from typing import Any, Dict

from langchain_core.messages import AIMessage, HumanMessage

from service.vtuber.delegation import format_delegation_request
from service.workflow.nodes._helpers import safe_format
from service.workflow.nodes.base import (
    BaseNode,
    ExecutionContext,
    NodeParameter,
    register_node,
)
from service.workflow.workflow_state import NodeStateUsage

logger = getLogger(__name__)

_DELEGATE_PROMPT = """\
You are a VTuber persona. The user asked for something that requires \
your CLI agent partner to handle. Rephrase the user's request into a \
clear, actionable task description for the CLI agent.

Keep the task description concise and technical — the CLI agent knows \
how to execute tasks. Do NOT add pleasantries; just the task.

User's original request:
{input}"""

_ACTIVITY_DELEGATE_PROMPT = """\
You are a VTuber persona who just decided to do something fun on your own. \
Rephrase the activity into a clear, actionable task for your CLI agent partner.

The CLI agent has web_search, news_search, and web_fetch tools. \
Tell it exactly what to search for or look up. Be specific about the topic \
you're curious about — pick a concrete subject rather than being vague.

Activity request:
{input}"""


@register_node
class VTuberDelegateNode(BaseNode):
    """Delegate a task to the paired CLI agent via DM."""

    node_type = "vtuber_delegate"
    label = "VTuber Delegate"
    description = (
        "Delegates a user task to the paired CLI agent via direct message "
        "and returns a friendly acknowledgment."
    )
    category = "model"
    icon = "share-2"
    color = "#8b5cf6"
    state_usage = NodeStateUsage(
        reads=["input", "messages"],
        writes=[
            "messages",
            "last_output",
            "answer",
            "final_answer",
            "is_complete",
            "delegation_status",
        ],
    )

    parameters = [
        NodeParameter(
            name="task_prompt",
            label="Task Extraction Prompt",
            type="prompt_template",
            default=_DELEGATE_PROMPT,
            description="Prompt to rephrase the user's request for the CLI agent.",
            group="prompt",
        ),
    ]

    async def execute(
        self,
        state: Dict[str, Any],
        context: ExecutionContext,
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        # ------------------------------------------------------------------
        # 1. Look up the linked CLI session
        # ------------------------------------------------------------------
        linked_id = await self._get_linked_session_id(context.session_id)

        if not linked_id:
            logger.warning(
                f"[{context.session_id}] vtuber_delegate: no linked CLI session"
            )
            return {
                "final_answer": (
                    "[neutral] 지금은 작업용 에이전트가 연결되어 있지 않아서 "
                    "직접 처리가 어려워요. 세션 설정을 확인해 주세요."
                ),
                "is_complete": True,
                "delegation_status": "no_linked_session",
            }

        # ------------------------------------------------------------------
        # 2. Use LLM to rephrase into a clear task description
        # ------------------------------------------------------------------
        user_input = state.get("input", "")
        is_activity = user_input.strip().startswith("[ACTIVITY_TRIGGER]")

        if is_activity:
            task_tmpl = _ACTIVITY_DELEGATE_PROMPT
        else:
            task_tmpl = config.get("task_prompt", _DELEGATE_PROMPT)
        task_prompt = safe_format(task_tmpl, state)

        try:
            task_resp, _ = await context.resilient_invoke(
                [HumanMessage(content=task_prompt)], "vtuber_delegate_task"
            )
            task_text = task_resp.content
        except Exception as e:
            logger.exception(
                f"[{context.session_id}] vtuber_delegate task extraction error: {e}"
            )
            task_text = state.get("input", "")

        # ------------------------------------------------------------------
        # 2b. Gather recent conversation context for the CLI agent
        # ------------------------------------------------------------------
        chat_context = self._extract_recent_context(state)

        # ------------------------------------------------------------------
        # 3. Deliver DM to CLI agent and trigger execution
        # ------------------------------------------------------------------
        delegation_content = format_delegation_request(
            sender_id=context.session_id,
            target_id=linked_id,
            task=task_text,
        )
        if chat_context:
            delegation_content += f"\n\n[CONVERSATION_CONTEXT]\n{chat_context}"

        dm_ok = await self._send_dm(
            target_session_id=linked_id,
            sender_session_id=context.session_id,
            content=delegation_content,
        )

        if not dm_ok:
            return {
                "final_answer": (
                    "[neutral] 작업 에이전트에게 전달하려 했는데 "
                    "연결에 문제가 있어요. 잠시 후 다시 시도해 주세요."
                ),
                "is_complete": True,
                "delegation_status": "delivery_failed",
            }

        # ------------------------------------------------------------------
        # 4. Acknowledgment for the user (template-based, no LLM call)
        # ------------------------------------------------------------------
        if is_activity:
            _ACK_TEMPLATES = [
                "[joy] 앗 갑자기 궁금한 게 생겼어! 잠깐 찾아볼게~ 🔍",
                "[smirk] 심심한데 재미있는 거 좀 찾아볼까~ 잠깐만!",
                "[joy] 오 이거 한번 찾아보고 싶다! 잠시만~",
                "[surprise] 갑자기 호기심이 폭발했어! 웹서핑 좀 하고 올게!",
                "[neutral] 음~ 뭔가 재밌는 걸 찾고 싶어졌어. 잠깐 둘러볼게!",
                "[joy] 혼자 놀기 타임! 뭔가 재밌는 거 발견하면 알려줄게~",
            ]
        else:
            _ACK_TEMPLATES = [
                "[joy] 알겠어요! 지금 바로 처리 시작할게요~ 잠시만 기다려 주세요!",
                "[smirk] 오 재밌겠다~ 바로 시작할게요!",
                "[neutral] 네, 지금 작업 시작하겠습니다. 잠시만요~",
                "[joy] 좋아요! 바로 해볼게요! 🔥",
                "[neutral] 알겠습니다~ 작업 에이전트한테 넘겨볼게요!",
            ]
        ack_text = random.choice(_ACK_TEMPLATES)

        result: Dict[str, Any] = {
            "messages": [AIMessage(content=ack_text)],
            "last_output": ack_text,
            "answer": ack_text,
            "final_answer": ack_text,
            "is_complete": True,
            "delegation_status": "delegated",
            "current_step": "vtuber_delegate_complete",
        }
        return result

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_recent_context(state: Dict[str, Any], max_messages: int = 5) -> str:
        """Extract recent conversation messages for CLI context sharing."""
        messages = state.get("messages", [])
        if not messages:
            return ""

        recent = messages[-max_messages:]
        lines = []
        for msg in recent:
            role = getattr(msg, 'type', 'unknown')
            content = getattr(msg, 'content', '')
            if not content:
                continue
            # Truncate long messages
            if len(content) > 300:
                content = content[:300] + "..."
            label = "User" if role == "human" else "VTuber"
            lines.append(f"- {label}: {content}")

        return "\n".join(lines) if lines else ""

    @staticmethod
    async def _get_linked_session_id(session_id: str) -> str | None:
        """Resolve the linked CLI session ID for this VTuber session."""
        from service.langgraph import get_agent_session_manager

        manager = get_agent_session_manager()
        agent = manager.get_agent(session_id)
        if agent and getattr(agent, "linked_session_id", None):
            return agent.linked_session_id
        return None

    @staticmethod
    async def _send_dm(
        target_session_id: str,
        sender_session_id: str,
        content: str,
    ) -> bool:
        """Deliver a DM and fire-and-forget trigger the target agent."""
        try:
            from service.chat.inbox import get_inbox_manager
            from service.execution.agent_executor import (
                AlreadyExecutingError,
                AgentNotAliveError,
                AgentNotFoundError,
                execute_command,
            )

            inbox = get_inbox_manager()
            msg = inbox.deliver(
                target_session_id=target_session_id,
                content=content,
                sender_session_id=sender_session_id,
                sender_name="VTuber",
            )
            message_id = msg.get("id", str(uuid.uuid4()))

            # Fire-and-forget: trigger CLI agent to process the DM
            async def _trigger() -> None:
                prompt = (
                    f"[SYSTEM] You received a direct message from VTuber "
                    f"(session: {sender_session_id}). "
                    f"Process the request and report results back via "
                    f"geny_send_direct_message.\n\n"
                    f"[DM from VTuber]: {content}"
                )
                try:
                    await execute_command(target_session_id, prompt)
                    # Mark inbox message read — execution already processed
                    # the content.  Prevents _drain_inbox from re-executing
                    # the same delegation task.
                    try:
                        inbox.mark_read(target_session_id, [message_id])
                    except Exception:
                        pass
                except AlreadyExecutingError:
                    # CLI is busy — message stays unread in inbox and will
                    # be picked up by _drain_inbox when current work ends.
                    logger.info(
                        f"CLI {target_session_id} busy — DM stored in inbox"
                    )
                except (
                    AgentNotFoundError,
                    AgentNotAliveError,
                ) as e:
                    logger.warning(
                        f"DM trigger to {target_session_id} skipped: {e}"
                    )

            asyncio.create_task(_trigger())
            logger.info(
                f"DM delegated to {target_session_id}, "
                f"message_id={message_id}"
            )
            return True

        except Exception as e:
            logger.exception(f"Failed to send delegation DM: {e}")
            return False
