"""
Memory Reflect Node — LLM-powered post-execution insight extraction.

Analyzes execution input/output with the LLM to extract reusable
insights, then saves them as structured memory notes with frontmatter
tags, categories, and backlinks.
"""

from __future__ import annotations

from logging import getLogger
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage

from service.workflow.nodes.base import (
    BaseNode,
    ExecutionContext,
    NodeParameter,
    register_node,
)
from service.workflow.workflow_state import NodeStateUsage
from service.workflow.nodes.i18n import MEMORY_REFLECT_I18N

logger = getLogger(__name__)


# ── Reflection prompt ─────────────────────────────────────────────────

_REFLECT_PROMPT = """\
Analyze the following execution and extract any reusable knowledge, \
decisions, or insights worth remembering for future tasks.

<input>
{input}
</input>

<output>
{output}
</output>

Extract concise, reusable insights. Skip trivial/obvious observations.

Respond with JSON only:
{{
  "learned": [
    {{
      "title": "concise title (3-10 words)",
      "content": "what was learned (1-3 sentences, markdown ok)",
      "category": "topics|insights|entities|projects",
      "tags": ["tag1", "tag2"],
      "importance": "low|medium|high",
      "related_to": []
    }}
  ],
  "should_save": true
}}

If nothing meaningful was learned, return:
{{"learned": [], "should_save": false}}"""


@register_node
class MemoryReflectNode(BaseNode):
    """Analyze execution results and save reusable insights to memory.

    Uses the LLM to reflect on what happened during execution,
    extract key learnings, and save them as structured memory notes
    with YAML frontmatter (tags, categories, importance).

    Writes no state fields — all output goes to the memory system.
    """

    node_type = "memory_reflect"
    label = "Memory Reflect"
    description = (
        "LLM-powered post-execution reflection. Analyzes the input "
        "and output of the current execution to extract reusable "
        "insights, then saves them as structured memory notes with "
        "tags, categories, and backlinks."
    )
    category = "memory"
    icon = "lightbulb"
    color = "#ec4899"
    i18n = MEMORY_REFLECT_I18N
    state_usage = NodeStateUsage(
        reads=["skip_memory_reflect"],
        writes=[],
        config_dynamic_reads={
            "input_field": "input",
            "output_field": "final_answer",
        },
    )

    parameters = [
        NodeParameter(
            name="input_field",
            label="Input State Field",
            type="string",
            default="input",
            description="State field containing the original user input.",
            group="state_fields",
        ),
        NodeParameter(
            name="output_field",
            label="Output State Field",
            type="string",
            default="final_answer",
            description=(
                "State field containing the execution output to reflect on. "
                "Falls back to 'answer' then 'last_output' if empty."
            ),
            group="state_fields",
        ),
        NodeParameter(
            name="max_insights",
            label="Max Insights",
            type="number",
            default=3,
            min=1,
            max=10,
            description="Maximum number of insights to extract per execution.",
            group="behavior",
        ),
    ]

    async def execute(
        self,
        state: Dict[str, Any],
        context: ExecutionContext,
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not context.memory_manager:
            logger.debug(f"[{context.session_id}] memory_reflect: no memory manager")
            return {}

        # Skip when upstream node explicitly requests it (e.g. [SILENT] thinking)
        if state.get("skip_memory_reflect"):
            logger.debug(f"[{context.session_id}] memory_reflect: skipped (skip_memory_reflect flag)")
            return {}

        try:
            # ── Extract input and output from state ───────────────────
            input_field = config.get("input_field", "input")
            output_field = config.get("output_field", "final_answer")
            max_insights = int(config.get("max_insights", 3))

            input_text = state.get(input_field, "") or ""
            output_text = (
                state.get(output_field, "")
                or state.get("answer", "")
                or state.get("last_output", "")
                or ""
            )

            # Skip if nothing to reflect on
            if not input_text.strip() or not output_text.strip():
                logger.debug(
                    f"[{context.session_id}] memory_reflect: "
                    f"empty input/output — skipping"
                )
                return {}

            # Truncate for LLM
            input_text = input_text[:2000]
            output_text = output_text[:3000]

            # ── Call LLM for reflection ───────────────────────────────
            from service.workflow.nodes.structured_output import (
                MemoryReflectOutput,
            )

            prompt = _REFLECT_PROMPT.format(
                input=input_text, output=output_text,
            )
            messages = [HumanMessage(content=prompt)]

            parsed, cost_updates = await context.memory_structured_invoke(
                messages,
                "memory_reflect",
                MemoryReflectOutput,
            )

            if not parsed.should_save or not parsed.learned:
                logger.info(
                    f"[{context.session_id}] memory_reflect: "
                    f"LLM decided nothing worth saving"
                )
                return cost_updates

            # ── Save insights as structured notes ─────────────────────
            mgr = context.memory_manager
            saved = 0

            for item in parsed.learned[:max_insights]:
                try:
                    filename = mgr.write_note(
                        title=item.title,
                        content=item.content,
                        category=item.category or "insights",
                        tags=item.tags or [],
                        importance=item.importance or "medium",
                        source="reflection",
                    )
                    if filename:
                        saved += 1
                        # Create backlinks to related notes
                        for related in item.related_to or []:
                            try:
                                mgr.link_notes(filename, related)
                            except Exception:
                                pass
                except Exception as e:
                    logger.debug(
                        f"[{context.session_id}] memory_reflect: "
                        f"failed to save insight '{item.title}': {e}"
                    )

            logger.info(
                f"[{context.session_id}] memory_reflect: "
                f"saved {saved}/{len(parsed.learned)} insights"
            )

            # ── Auto-promote high-importance insights to curated knowledge ──
            if saved > 0 and context.curated_knowledge_manager:
                try:
                    from service.config.sub_config.general.ltm_config import LTMConfig
                    from service.config import get_config_manager

                    ltm_cfg = get_config_manager().load_config(LTMConfig)
                    if ltm_cfg and ltm_cfg.curated_knowledge_enabled and ltm_cfg.auto_curation_enabled:
                        ck = context.curated_knowledge_manager
                        promoted = 0
                        for item in parsed.learned[:max_insights]:
                            if item.importance in ("high", "critical"):
                                try:
                                    fn = ck.write_note(
                                        title=item.title,
                                        content=item.content,
                                        category=item.category or "insights",
                                        tags=(item.tags or []) + ["auto-promoted"],
                                        importance=item.importance,
                                        source="promoted",
                                    )
                                    if fn:
                                        promoted += 1
                                except Exception:
                                    pass
                        if promoted:
                            logger.info(
                                f"[{context.session_id}] memory_reflect: "
                                f"auto-promoted {promoted} insights to curated knowledge"
                            )
                except Exception as ck_err:
                    logger.debug(
                        f"[{context.session_id}] memory_reflect: "
                        f"auto-promotion failed: {ck_err}"
                    )

            return cost_updates

        except Exception as e:
            logger.warning(
                f"[{context.session_id}] memory_reflect failed: {e}"
            )
            return {}
