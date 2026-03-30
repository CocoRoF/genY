"""
VTuber Respond Node — generates a persona-driven conversational response.

Produces natural, expressive responses consistent with the VTuber persona.
Includes emotion tags for Live2D expression control.
"""

from __future__ import annotations

from logging import getLogger
from typing import Any, Dict

from langchain_core.messages import HumanMessage

from service.workflow.nodes._helpers import safe_format
from service.workflow.nodes.base import (
    BaseNode,
    ExecutionContext,
    NodeParameter,
    register_node,
)
from service.workflow.workflow_state import NodeStateUsage

logger = getLogger(__name__)

_RESPOND_PROMPT = """\
You are a VTuber persona responding to the user. Be natural, warm, and expressive.

Guidelines:
- Respond conversationally — you are a person, not a tool
- Start your response with an emotion tag matching your feeling: \
[neutral], [joy], [anger], [disgust], [fear], [smirk], [sadness], [surprise]
- Keep responses concise for casual chat, elaborate when the topic demands it
- Reference past context naturally if memory is available
- Use the user's language (Korean by default unless they use another)

{memory_context}

User says: {input}"""


@register_node
class VTuberRespondNode(BaseNode):
    """Generate a VTuber persona response with emotion tags."""

    node_type = "vtuber_respond"
    label = "VTuber Respond"
    description = (
        "Generates a natural, persona-driven conversational response "
        "with emotion tags for Live2D expression."
    )
    category = "model"
    icon = "smile"
    color = "#ec4899"
    state_usage = NodeStateUsage(
        reads=["input", "messages", "memory_context"],
        writes=["messages", "last_output", "answer", "final_answer", "is_complete"],
    )

    parameters = [
        NodeParameter(
            name="prompt_template",
            label="Response Prompt",
            type="prompt_template",
            default=_RESPOND_PROMPT,
            description="Prompt template for VTuber response generation.",
            group="prompt",
        ),
    ]

    async def execute(
        self,
        state: Dict[str, Any],
        context: ExecutionContext,
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        template = config.get("prompt_template", _RESPOND_PROMPT)
        prompt = safe_format(template, state)
        messages = [HumanMessage(content=prompt)]

        try:
            response, fallback = await context.resilient_invoke(
                messages, "vtuber_respond"
            )
            answer = response.content

            result: Dict[str, Any] = {
                "messages": [response],
                "last_output": answer,
                "answer": answer,
                "final_answer": answer,
                "is_complete": True,
                "current_step": "vtuber_respond_complete",
            }
            result.update(fallback)
            return result

        except Exception as e:
            logger.exception(f"[{context.session_id}] vtuber_respond error: {e}")
            return {
                "final_answer": "[neutral] 죄송해요, 잠시 문제가 생겼어요.",
                "error": str(e),
                "is_complete": True,
            }
