"""
VTuber Think Node — self-initiated thinking / internal monologue.

Triggered when the VTuber receives a [THINKING_TRIGGER] or [CLI_RESULT]
prefix. Produces an internal reflection that may optionally surface to the
user as a natural remark.
"""

from __future__ import annotations

from logging import getLogger
from typing import Any, Dict

from langchain_core.messages import AIMessage, HumanMessage

from service.workflow.nodes._helpers import safe_format
from service.workflow.nodes.base import (
    BaseNode,
    ExecutionContext,
    NodeParameter,
    register_node,
)
from service.workflow.workflow_state import NodeStateUsage

logger = getLogger(__name__)

_THINK_PROMPT = """\
You are a VTuber persona engaging in a moment of internal reflection.

Context for this thought:
{input}

{memory_context}

Instructions:
- Reflect on what happened, what the user might need next, or something \
interesting you noticed.
- If triggered by [CLI_RESULT], summarize what the CLI agent accomplished \
and frame it conversationally for the user.
- Start with an emotion tag: [neutral], [joy], [smirk], [surprise], etc.
- Keep the response natural — as if you're thinking out loud or sharing an \
observation.
- Use the user's language (Korean default).

If the trigger is purely internal (no user-facing value), respond with \
exactly: [SILENT]"""


@register_node
class VTuberThinkNode(BaseNode):
    """Self-initiated thinking / internal monologue for the VTuber."""

    node_type = "vtuber_think"
    label = "VTuber Think"
    description = (
        "Processes internal triggers and CLI results, producing "
        "reflective or summary responses."
    )
    category = "model"
    icon = "brain"
    color = "#f59e0b"
    state_usage = NodeStateUsage(
        reads=["input", "messages", "memory_context"],
        writes=["messages", "last_output", "answer", "final_answer", "is_complete"],
    )

    parameters = [
        NodeParameter(
            name="think_prompt",
            label="Think Prompt",
            type="prompt_template",
            default=_THINK_PROMPT,
            description="Prompt template for VTuber internal thinking.",
            group="prompt",
        ),
    ]

    async def execute(
        self,
        state: Dict[str, Any],
        context: ExecutionContext,
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        tmpl = config.get("think_prompt", _THINK_PROMPT)
        prompt = safe_format(tmpl, state)
        messages = [HumanMessage(content=prompt)]

        try:
            response, fallback = await context.resilient_invoke(
                messages, "vtuber_think"
            )
            answer = response.content.strip()

            # If the model decided there's nothing user-facing, stay silent
            if answer == "[SILENT]":
                logger.info(
                    f"[{context.session_id}] vtuber_think: silent — no output"
                )
                return {
                    "is_complete": True,
                    "current_step": "vtuber_think_silent",
                }

            result: Dict[str, Any] = {
                "messages": [AIMessage(content=answer)],
                "last_output": answer,
                "answer": answer,
                "final_answer": answer,
                "is_complete": True,
                "current_step": "vtuber_think_complete",
            }
            result.update(fallback)
            return result

        except Exception as e:
            logger.exception(f"[{context.session_id}] vtuber_think error: {e}")
            return {
                "is_complete": True,
                "current_step": "vtuber_think_error",
            }
