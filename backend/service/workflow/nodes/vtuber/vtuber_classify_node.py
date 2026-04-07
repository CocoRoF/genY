"""
VTuber Classify Node — routes VTuber input to the appropriate handler.

Classifies user input into three categories:
  - direct_response: casual chat, greetings, simple questions
  - delegate_to_cli: complex tasks requiring tools/code
  - thinking: self-initiated thought (triggered by system events)
"""

from __future__ import annotations

from logging import getLogger
from typing import Any, Dict, List

from langchain_core.messages import HumanMessage

from service.workflow.nodes._helpers import safe_format
from service.workflow.nodes.base import (
    BaseNode,
    ExecutionContext,
    NodeParameter,
    OutputPort,
    register_node,
)
from service.workflow.workflow_state import NodeStateUsage

logger = getLogger(__name__)

_CLASSIFY_PROMPT = """\
You are a VTuber persona's task router. Classify the incoming input to decide \
how to handle it.

## Categories

### direct_response
Handle directly — no tools needed.
- Greetings, farewells, casual chat
- Simple factual questions
- Emotional responses, encouragement
- Daily planning discussion, schedule talk
- Memory recall questions ("what did we talk about?")
- Quick opinions or preferences

### delegate_to_cli
Delegate to the paired CLI worker — requires tools or sustained work.
- Code writing, debugging, modification
- File operations (create, edit, delete)
- Shell commands (git, npm, docker, etc.)
- Complex research or multi-step analysis
- System administration tasks
- Any task that benefits from autonomous tool usage

### thinking
Autonomous self-initiated process — ONLY when the input starts with \
[THINKING_TRIGGER] or [CLI_RESULT]. These are internal system signals, \
NOT user messages.

## Input
{input}

Respond with ONLY one word: direct_response, delegate_to_cli, or thinking"""


@register_node
class VTuberClassifyNode(BaseNode):
    """Classify VTuber input into direct_response / delegate_to_cli / thinking."""

    node_type = "vtuber_classify"
    label = "VTuber Classify"
    description = (
        "Routes VTuber input: direct chat responses, CLI delegation, "
        "or self-initiated thinking."
    )
    category = "model"
    icon = "message-circle"
    color = "#8b5cf6"
    state_usage = NodeStateUsage(
        reads=["input"],
        writes=["current_step", "messages", "last_output", "vtuber_route"],
    )

    parameters = [
        NodeParameter(
            name="prompt_template",
            label="Classification Prompt",
            type="prompt_template",
            default=_CLASSIFY_PROMPT,
            description="Prompt template for VTuber input classification.",
            group="prompt",
        ),
    ]

    output_ports = [
        OutputPort(id="direct_response", label="Direct Response", description="Handle directly"),
        OutputPort(id="delegate_to_cli", label="Delegate to CLI", description="Send to CLI agent"),
        OutputPort(id="thinking", label="Thinking", description="Self-initiated thought"),
    ]

    def get_output_ports(self, config: Dict[str, Any] | None = None) -> List[OutputPort]:
        return self.output_ports

    def get_router(self, config: Dict[str, Any] | None = None):
        """Return a routing function for conditional edge wiring."""
        valid = {"direct_response", "delegate_to_cli", "thinking"}

        def _route(state: Dict[str, Any]) -> str:
            route = state.get("vtuber_route", "direct_response")
            return route if route in valid else "direct_response"

        return _route

    async def execute(
        self,
        state: Dict[str, Any],
        context: ExecutionContext,
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        user_input = state.get("input", "")

        # Fast-path: system thinking triggers bypass LLM classification
        if user_input.strip().startswith("[THINKING_TRIGGER"):
            return {
                "vtuber_route": "thinking",
                "current_step": "vtuber_classify_complete",
            }
        if user_input.strip().startswith("[CLI_RESULT]") or user_input.strip().startswith("[DELEGATION_RESULT]"):
            return {
                "vtuber_route": "thinking",
                "current_step": "vtuber_classify_complete",
            }

        template = config.get("prompt_template", _CLASSIFY_PROMPT)
        prompt = safe_format(template, state)
        messages = [HumanMessage(content=prompt)]

        try:
            response, fallback = await context.resilient_invoke(
                messages, "vtuber_classify"
            )
            raw = response.content.strip().lower()

            # Parse classification
            valid_routes = {"direct_response", "delegate_to_cli", "thinking"}
            route = "direct_response"  # default fallback
            for v in valid_routes:
                if v in raw:
                    route = v
                    break

            result: Dict[str, Any] = {
                "vtuber_route": route,
                "messages": [response],
                "last_output": raw,
                "current_step": "vtuber_classify_complete",
            }
            result.update(fallback)
            return result

        except Exception as e:
            logger.exception(f"[{context.session_id}] vtuber_classify error: {e}")
            return {
                "vtuber_route": "direct_response",
                "error": str(e),
                "current_step": "vtuber_classify_error",
            }
