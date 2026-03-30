"""
VTuber Delegate Node — routes a task to the paired CLI Agent via DM.

Uses the inbox + auto-trigger mechanism to send the task,
then returns a conversational acknowledgment to the user.
"""

from __future__ import annotations

import asyncio
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

_ACK_PROMPT = """\
You are a VTuber persona. You just delegated a task to your CLI agent \
partner. Write a short, friendly acknowledgment for the user.

Start with an emotion tag: [neutral], [joy], [smirk], etc.
Say something like "I've started working on it" in a natural way.
Use the same language as the user.

User's original request:
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
        NodeParameter(
            name="ack_prompt",
            label="Acknowledgment Prompt",
            type="prompt_template",
            default=_ACK_PROMPT,
            description="Prompt for the friendly acknowledgment to the user.",
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
        # 3. Deliver DM to CLI agent and trigger execution
        # ------------------------------------------------------------------
        dm_ok = await self._send_dm(
            target_session_id=linked_id,
            sender_session_id=context.session_id,
            content=format_delegation_request(
                sender_id=context.session_id,
                target_id=linked_id,
                task=task_text,
            ),
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
        # 4. Generate acknowledgment for the user
        # ------------------------------------------------------------------
        ack_tmpl = config.get("ack_prompt", _ACK_PROMPT)
        ack_prompt = safe_format(ack_tmpl, state)

        try:
            ack_resp, fallback = await context.resilient_invoke(
                [HumanMessage(content=ack_prompt)], "vtuber_delegate_ack"
            )
            ack_text = ack_resp.content
        except Exception:
            ack_text = "[joy] 알겠어요! 지금 바로 처리 시작할게요~ 잠시만 기다려 주세요!"

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
                except (
                    AlreadyExecutingError,
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
