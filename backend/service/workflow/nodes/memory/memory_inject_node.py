"""
Memory Inject Node — LLM-gated memory injection at graph start.

The LLM itself decides whether the input warrants long-term memory
retrieval. When activated, performs vector semantic search and keyword
search, then injects both structured MemoryRef entries and formatted
context text into state.
"""

from __future__ import annotations

from logging import getLogger
from typing import Any, Dict, List

from langchain_core.messages import HumanMessage

from service.langgraph.state import MemoryRef
from service.workflow.nodes.base import (
    BaseNode,
    ExecutionContext,
    NodeParameter,
    register_node,
)
from service.workflow.workflow_state import NodeStateUsage
from service.workflow.nodes.i18n import MEMORY_INJECT_I18N

logger = getLogger(__name__)


# ── Importance boost factors for structured notes ─────────────────────

IMPORTANCE_BOOST = {
    "critical": 2.0,
    "high": 1.5,
    "medium": 1.0,
    "low": 0.5,
}


# ── LLM gate prompt ──────────────────────────────────────────────────

_MEMORY_GATE_PROMPT = """\
You are a memory retrieval gate. Decide whether the user's input \
requires searching long-term memory for relevant context.

Answer "needs_memory": true when:
- The input references previous work, past conversations, or prior context
- The task is complex or multi-step (building, debugging, designing, analyzing)
- The input asks to continue, resume, or follow up on something
- Domain-specific knowledge from past sessions would improve the response
- The input contains technical terms or project-specific references

Answer "needs_memory": false when:
- Simple greetings or farewells (hi, hello, bye, good morning)
- Short acknowledgments (ok, yes, no, thanks, got it, thank you)
- Trivial one-shot questions needing no prior context (What is 2+2?)
- Meta-commands about the agent itself (help, status, version)

Respond with JSON only: {{"needs_memory": true/false, "reasoning": "brief reason"}}

User input:
{input}"""


@register_node
class MemoryInjectNode(BaseNode):
    """Load relevant memory context into state at graph start.

    Uses an **LLM gate** to decide whether the input warrants
    long-term memory retrieval. If the gate says yes, runs a
    multi-stage retrieval pipeline:
      1. Session summary (short-term)
      2. MEMORY.md (long-term persistent notes)
      3. FAISS vector semantic search (if enabled)
      4. Keyword-based memory recall

    Writes both ``memory_refs`` (structured metadata) and
    ``memory_context`` (formatted text block) to state.
    """

    node_type = "memory_inject"
    label = "Memory Inject"
    description = (
        "LLM-gated memory injection. The LLM itself decides whether "
        "the input needs long-term memory context. When activated, "
        "performs vector semantic search and keyword search, then "
        "injects both structured MemoryRef entries (memory_refs) and "
        "formatted context text (memory_context) into state."
    )
    category = "memory"
    icon = "brain"
    color = "#ec4899"
    i18n = MEMORY_INJECT_I18N
    state_usage = NodeStateUsage(
        reads=[],
        writes=["memory_refs", "memory_context"],
        config_dynamic_reads={"search_field": "input"},
    )

    parameters = [
        NodeParameter(
            name="max_results",
            label="Max Memory Results",
            type="number",
            default=5,
            min=1,
            max=20,
            description="Maximum number of memory chunks to load per search type.",
            group="behavior",
        ),
        NodeParameter(
            name="search_chars",
            label="Search Input Length",
            type="number",
            default=500,
            min=50,
            max=5000,
            description="Character limit of input text used for memory search.",
            group="behavior",
        ),
        NodeParameter(
            name="max_inject_chars",
            label="Max Inject Characters",
            type="number",
            default=10000,
            min=500,
            max=50000,
            description="Maximum total characters of memory context to inject into state.",
            group="behavior",
        ),
        NodeParameter(
            name="enable_llm_gate",
            label="Enable LLM Gate",
            type="boolean",
            default=True,
            description=(
                "Use the LLM to decide whether memory retrieval is needed. "
                "When disabled, memory is always retrieved for non-empty inputs."
            ),
            group="behavior",
        ),
        NodeParameter(
            name="enable_vector_search",
            label="Enable Vector Search",
            type="boolean",
            default=True,
            description="Enable FAISS vector semantic search. When disabled, only keyword search is used.",
            group="behavior",
        ),
        NodeParameter(
            name="search_field",
            label="Search Source Field",
            type="string",
            default="input",
            description="State field whose value is used as the memory search query.",
            group="state_fields",
        ),
    ]

    # ── LLM gate ──────────────────────────────────────────────────────

    async def _check_memory_needed(
        self,
        input_text: str,
        context: ExecutionContext,
    ) -> tuple:
        """Ask the LLM whether *input_text* warrants memory retrieval.

        Uses structured output parsing with automatic fallback.
        Returns ``(True, cost_updates)`` (retrieve memory) on any
        parsing failure so that memory is never silently lost.

        Returns:
            (needs_memory_bool, cost_updates_dict)
        """
        from service.workflow.nodes.structured_output import MemoryGateOutput

        prompt = _MEMORY_GATE_PROMPT.format(input=input_text[:500])
        messages = [HumanMessage(content=prompt)]

        try:
            parsed, cost_updates = await context.memory_structured_invoke(
                messages,
                "memory_gate",
                MemoryGateOutput,
            )
            decision = parsed.needs_memory
            logger.debug(
                f"[{context.session_id}] memory_gate: "
                f"needs_memory={decision} "
                f"(reason: {parsed.reasoning or '-'})"
            )
            return decision, cost_updates

        except Exception as exc:
            # On any failure, default to retrieving memory (safe side)
            logger.warning(
                f"[{context.session_id}] memory_gate: "
                f"LLM gate failed ({exc}), defaulting to retrieve"
            )
            return True, {}

    # ── Main execution ────────────────────────────────────────────────

    @staticmethod
    def _add_linked_context(
        refs: List[MemoryRef],
        memory_manager,
        budget_chars: int,
    ) -> str:
        """Load notes linked from already-selected files (backlinks).

        Stays within *budget_chars*.  Returns formatted XML block or "".
        """
        already_loaded = {r.get("filename", "") for r in refs}
        linked_parts: List[str] = []
        total = 0

        for ref in refs:
            fn = ref.get("filename", "")
            if not fn:
                continue
            note = memory_manager.read_note(fn)
            if note is None:
                continue
            meta = note.get("metadata") or {}
            for linked_fn in meta.get("links_to", []):
                if linked_fn in already_loaded:
                    continue
                already_loaded.add(linked_fn)
                linked_note = memory_manager.read_note(linked_fn)
                if linked_note is None:
                    continue
                body = (linked_note.get("body") or "")[:800]
                chunk = (
                    f'<linked-context from="{fn}" to="{linked_fn}">\n'
                    f"{body}\n"
                    f"</linked-context>"
                )
                if (total + len(chunk)) > budget_chars:
                    break
                linked_parts.append(chunk)
                total += len(chunk)
            if total >= budget_chars:
                break

        return "\n\n".join(linked_parts) if linked_parts else ""

    async def execute(
        self,
        state: Dict[str, Any],
        context: ExecutionContext,
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not context.memory_manager:
            logger.debug(f"[{context.session_id}] memory_inject: no memory manager")
            return {}

        # Guard: skip entirely when LTM is disabled in config
        try:
            from service.config.sub_config.general.ltm_config import LTMConfig

            if not LTMConfig.is_enabled():
                logger.debug(
                    f"[{context.session_id}] memory_inject: "
                    f"LTM disabled in config — skipping"
                )
                return {}
        except Exception:
            pass  # config system unavailable — proceed with caution

        try:
            # ── Extract parameters ────────────────────────────────────
            search_field = config.get("search_field", "input")
            input_text = state.get(search_field, "") or ""
            max_results = int(config.get("max_results", 5))
            search_chars = int(config.get("search_chars", 500))
            max_inject = int(config.get("max_inject_chars", 10000))
            enable_gate = config.get("enable_llm_gate", True)
            enable_vector = config.get("enable_vector_search", True)

            query = input_text[:search_chars].strip()

            if not query:
                return {}

            # ── LLM gate: let the model decide ───────────────────────
            gate_cost = {}
            if enable_gate:
                needs_memory, gate_cost = await self._check_memory_needed(
                    query, context,
                )
                if not needs_memory:
                    logger.info(
                        f"[{context.session_id}] memory_inject: "
                        f"LLM gate decided memory not needed — skipping"
                    )
                    return gate_cost

            # ── Build memory context with budget management ───────────
            mgr = context.memory_manager
            parts: List[str] = []
            refs: List[MemoryRef] = []
            total_chars = 0
            budget = max_inject

            # 1. Session summary (latest short-term state)
            try:
                summary = mgr.short_term.get_summary()
                if summary and (total_chars + len(summary)) <= budget:
                    parts.append(
                        f"<session-summary>\n{summary}\n</session-summary>"
                    )
                    total_chars += len(summary)
            except Exception:
                pass

            # 2. Main MEMORY.md (persistent long-term notes)
            try:
                main_mem = mgr.long_term.load_main()
                if main_mem and main_mem.content and (
                    total_chars + main_mem.char_count
                ) <= budget:
                    parts.append(
                        f'<long-term-memory source="{main_mem.filename}">\n'
                        f"{main_mem.content}\n"
                        f"</long-term-memory>"
                    )
                    total_chars += main_mem.char_count
                    refs.append({
                        "filename": main_mem.filename or "MEMORY.md",
                        "source": "long_term",
                        "char_count": main_mem.char_count,
                        "injected_at_turn": 0,
                    })
            except Exception:
                pass

            # 3. FAISS vector semantic search (if enabled)
            if enable_vector:
                vmm = mgr.vector_memory
                if vmm and vmm.enabled:
                    try:
                        v_results = await vmm.search(
                            query, top_k=max_results,
                        )
                        v_context = vmm.build_vector_context(
                            v_results, max_chars=budget - total_chars,
                        )
                        if v_context:
                            parts.append(v_context)
                            total_chars += len(v_context)
                        for vr in v_results:
                            refs.append({
                                "filename": vr.source_file,
                                "source": "vector",
                                "char_count": len(vr.text),
                                "injected_at_turn": 0,
                            })
                    except Exception as ve:
                        logger.debug(
                            f"[{context.session_id}] memory_inject: "
                            f"vector search failed: {ve}"
                        )

            # 4. Keyword-based memory recall (complementary) — with
            #    importance weighting and tag matching for structured notes
            remaining = budget - total_chars
            if remaining > 200:
                try:
                    kw_results = mgr.search(query, max_results=max_results)
                    # Apply importance boost and tag scoring
                    query_words = set(query.lower().split())
                    for r in kw_results:
                        imp = getattr(r.entry, "importance", "medium") or "medium"
                        r.score *= IMPORTANCE_BOOST.get(imp, 1.0)
                        tags = getattr(r.entry, "tags", None) or []
                        if tags and query_words:
                            tag_words = {t.lower() for t in tags}
                            overlap = len(query_words & tag_words)
                            r.score *= 1.0 + 0.3 * overlap
                    # Re-sort by boosted score
                    kw_results.sort(key=lambda r: r.score, reverse=True)

                    for r in kw_results:
                        chunk = (
                            f'<memory-recall source="{r.entry.filename}" '
                            f'score="{r.score:.2f}">\n'
                            f"{r.snippet}\n"
                            f"</memory-recall>"
                        )
                        if (total_chars + len(chunk)) > budget:
                            break
                        parts.append(chunk)
                        total_chars += len(chunk)
                        refs.append({
                            "filename": r.entry.filename or "unknown",
                            "source": r.entry.source.value,
                            "char_count": r.entry.char_count,
                            "injected_at_turn": 0,
                        })
                except Exception:
                    pass

            # 5. Backlink context — include notes linked from selected files
            remaining = budget - total_chars
            if remaining > 200 and refs:
                try:
                    linked_text = self._add_linked_context(
                        refs, mgr, remaining,
                    )
                    if linked_text:
                        parts.append(linked_text)
                        total_chars += len(linked_text)
                except Exception:
                    pass

            # 6. Curated Knowledge — quality-verified notes from user vault
            remaining = budget - total_chars
            if remaining > 200 and context.curated_knowledge_manager:
                try:
                    from service.config.sub_config.general.ltm_config import LTMConfig
                    from service.config import get_config_manager

                    ltm_cfg = get_config_manager().load_config(LTMConfig)
                    if ltm_cfg and ltm_cfg.curated_knowledge_enabled:
                        ck = context.curated_knowledge_manager
                        ck_budget = min(
                            remaining,
                            ltm_cfg.curated_inject_budget,
                        )
                        ck_max = ltm_cfg.curated_max_results

                        # 6a. Vector search if enabled
                        ck_text = ""
                        if ltm_cfg.curated_vector_enabled and ck.vector_enabled:
                            ck_text = await ck.vector_inject_context(
                                query, max_chars=ck_budget, top_k=ck_max,
                            )

                        # 6b. Keyword fallback
                        if not ck_text:
                            ck_text = ck.inject_context(
                                query, max_chars=ck_budget,
                            )

                        if ck_text:
                            parts.append(ck_text)
                            total_chars += len(ck_text)
                            refs.append({
                                "filename": "curated_knowledge",
                                "source": "curated_knowledge",
                                "char_count": len(ck_text),
                                "injected_at_turn": 0,
                            })
                            logger.info(
                                f"[{context.session_id}] memory_inject: "
                                f"injected {len(ck_text)} chars from curated knowledge"
                            )
                except Exception as ck_err:
                    logger.debug(
                        f"[{context.session_id}] memory_inject: "
                        f"curated knowledge injection failed: {ck_err}"
                    )

            # ── Assemble results ──────────────────────────────────────
            result: Dict[str, Any] = {}
            result.update(gate_cost)

            if parts:
                context_text = "## Recalled Memory\n\n" + "\n\n".join(parts)
                result["memory_context"] = context_text
                logger.info(
                    f"[{context.session_id}] memory_inject: "
                    f"injected {total_chars} chars of memory context"
                )

            if refs:
                result["memory_refs"] = refs
                logger.info(
                    f"[{context.session_id}] memory_inject: "
                    f"loaded {len(refs)} memory refs"
                )

            return result

        except Exception as e:
            logger.warning(f"[{context.session_id}] memory_inject failed: {e}")
            return {}
