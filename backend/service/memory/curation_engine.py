"""
Curation Engine — 5-Stage pipeline for refining User Opsidian notes
into Curated Knowledge.

Stages:
  1. Triage  — Rule-based filtering (cheap, no LLM cost)
  2. Analyze — LLM multi-dimensional quality assessment
  3. Transform — Strategy-specific LLM transformation
  4. Enrich  — Auto-tag, link suggestions, importance assessment
  5. Store   — Persist into CuratedKnowledgeManager + audit log

The engine bridges UserOpsidianManager → CuratedKnowledgeManager,
ensuring only high-quality, agent-ready knowledge passes through.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from logging import getLogger
from typing import Any, Dict, List, Optional

logger = getLogger(__name__)


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class CurationResult:
    """Outcome of a curation pipeline run."""
    success: bool
    curated_filename: Optional[str] = None
    method_used: Optional[str] = None
    quality_score: Optional[float] = None
    reason: Optional[str] = None
    analysis: Optional[Dict[str, Any]] = None


# ============================================================================
# Stage 1: Triage (rule-based filtering)
# ============================================================================

class CurationTriage:
    """Rule-based curation candidate filtering.

    Quickly decides whether a note is worth sending to LLM analysis,
    saving API cost on obvious includes/excludes.
    """

    # ── Auto-curate rules ──
    IMPORTANCE_THRESHOLD = {"high", "critical"}
    AUTO_CURATE_TAGS = {
        "important", "reference", "knowledge", "curate-me",
        "핵심", "중요", "레퍼런스",
    }
    AUTO_CURATE_CATEGORIES = {"reference", "insights", "projects"}
    AUTO_CURATE_PREFIXES = ["[REF]", "[핵심]", "[중요]", "[CORE]", "[KEY]"]
    MIN_BODY_LENGTH = 200

    # ── Auto-exclude rules ──
    EXCLUDE_TAGS = {"draft", "temp", "todo", "wip", "초안", "임시"}
    EXCLUDE_PREFIXES = ["[DRAFT]", "[TMP]", "[임시]", "[초안]"]

    @classmethod
    def triage(cls, note_metadata: dict, body: str) -> dict:
        """Classify note into auto_curate / candidate / exclude.

        Returns:
            {
                "action": "auto_curate" | "candidate" | "exclude",
                "reason": str,
                "confidence": float,
            }
        """
        importance = note_metadata.get("importance", "medium")
        tags = set(note_metadata.get("tags") or [])
        category = note_metadata.get("category", "")
        title = note_metadata.get("title", "")

        # Auto-exclude
        if tags & cls.EXCLUDE_TAGS:
            return {"action": "exclude", "reason": "draft/temp tag", "confidence": 0.95}
        if any(title.startswith(p) for p in cls.EXCLUDE_PREFIXES):
            return {"action": "exclude", "reason": "draft prefix", "confidence": 0.95}
        if len(body.strip()) < cls.MIN_BODY_LENGTH:
            return {"action": "exclude", "reason": "too short", "confidence": 0.80}

        # Auto-curate
        if importance in cls.IMPORTANCE_THRESHOLD:
            return {"action": "auto_curate", "reason": f"importance={importance}", "confidence": 0.90}
        if tags & cls.AUTO_CURATE_TAGS:
            matched = tags & cls.AUTO_CURATE_TAGS
            return {"action": "auto_curate", "reason": f"tags={matched}", "confidence": 0.85}
        if category in cls.AUTO_CURATE_CATEGORIES:
            return {"action": "auto_curate", "reason": f"category={category}", "confidence": 0.80}
        if any(title.startswith(p) for p in cls.AUTO_CURATE_PREFIXES):
            return {"action": "auto_curate", "reason": "title prefix", "confidence": 0.85}

        # Candidate — needs LLM analysis
        return {"action": "candidate", "reason": "needs_llm_analysis", "confidence": 0.50}


# ============================================================================
# Stage 2: LLM Analysis Prompts
# ============================================================================

_CURATION_ANALYSIS_PROMPT = """\
You are a Knowledge Curator AI. Analyze the following user note and \
provide a comprehensive curation assessment.

<note>
<title>{title}</title>
<category>{category}</category>
<tags>{tags}</tags>
<importance>{importance}</importance>
<body>
{body}
</body>
</note>

<existing_knowledge_index>
{existing_index}
</existing_knowledge_index>

Analyze and return JSON:
{{
  "quality_score": 0.0-1.0,
  "quality_dimensions": {{
    "factual_accuracy": 0.0-1.0,
    "completeness": 0.0-1.0,
    "actionability": 0.0-1.0,
    "uniqueness": 0.0-1.0,
    "clarity": 0.0-1.0
  }},
  "should_curate": true/false,
  "curation_strategy": "direct|summary|extract|merge|restructure|skip",
  "strategy_reasoning": "why this strategy was chosen",
  "suggested_title": "improved title if needed (or null)",
  "suggested_category": "topics|insights|entities|projects|reference",
  "suggested_tags": ["tag1", "tag2", "tag3"],
  "suggested_importance": "low|medium|high|critical",
  "related_existing_notes": ["filename1.md", "filename2.md"],
  "merge_candidates": ["filename.md"],
  "key_facts": ["fact 1", "fact 2"],
  "summary": "1-2 sentence summary of the note's value"
}}

Return ONLY valid JSON, no surrounding text."""


# ============================================================================
# Stage 3: Transform Prompts
# ============================================================================

_TRANSFORM_DIRECT_PROMPT = """\
Clean up the following note for agent consumption. Fix formatting but \
do NOT change any content or meaning. Keep the original language.

<title>{title}</title>
<body>{body}</body>

Return the cleaned content as Markdown (no frontmatter)."""

_TRANSFORM_SUMMARY_PROMPT = """\
Condense the following note into a concise, agent-ready knowledge entry.

Rules:
1. Preserve ALL key facts, decisions, and technical details
2. Remove personal musings, redundancy, and filler
3. Use structured format: headers, bullet points, code blocks
4. Keep the original language (Korean or English)
5. Target length: {target_chars} characters maximum

<title>{title}</title>
<body>{body}</body>

Return the curated content as clean Markdown (no frontmatter)."""

_TRANSFORM_EXTRACT_PROMPT = """\
From the following note, extract ONLY the key facts, specifications, \
decisions, and reusable knowledge.

Rules:
1. Extract as structured bullet points grouped by theme
2. Each fact must be self-contained (understandable without context)
3. Include precise numbers, names, versions, and dates
4. Skip opinions, speculation, and incomplete thoughts
5. Keep the original language

<title>{title}</title>
<body>{body}</body>

Return as grouped bullet points in Markdown."""

_TRANSFORM_MERGE_PROMPT = """\
Merge the following related notes into a single comprehensive \
knowledge entry.

Rules:
1. Combine all unique information — no data loss
2. Resolve contradictions (prefer the more recent/detailed version)
3. Organize by theme with clear headers
4. De-duplicate overlapping content
5. Keep the original language

{notes_xml}

Return the merged content as clean Markdown."""

_TRANSFORM_RESTRUCTURE_PROMPT = """\
Restructure the following note for maximum clarity and usability.

Rules:
1. Add clear headers and logical sections
2. Convert prose to bullet points where appropriate
3. Format code blocks with language tags
4. Add a brief TL;DR at the top
5. Do NOT add, infer, or change any facts — only reorganize
6. Keep the original language

<title>{title}</title>
<body>{body}</body>

Return the restructured content as clean Markdown."""


# ============================================================================
# Stage 4: Enrich Prompt
# ============================================================================

_ENRICH_PROMPT = """\
Given the following curated note and the existing knowledge index, \
suggest improvements.

<curated_note>
{curated_content}
</curated_note>

<existing_index>
{existing_index_summary}
</existing_index>

Return JSON:
{{
  "auto_tags": ["tag1", "tag2"],
  "suggested_links": ["filename.md"],
  "importance_assessment": "low|medium|high|critical",
  "title_improvement": null
}}

Return ONLY valid JSON."""


# ============================================================================
# Curation Engine (orchestrates all 5 stages)
# ============================================================================

class CurationEngine:
    """Orchestrates the 5-stage curation pipeline.

    Bridges UserOpsidianManager → CuratedKnowledgeManager
    using optional LLM assistance for quality assessment and
    content transformation.
    """

    def __init__(
        self,
        curated_manager,
        user_opsidian_manager=None,
        llm_model=None,
        quality_threshold: float = 0.6,
    ):
        self._curated = curated_manager
        self._opsidian = user_opsidian_manager
        self._llm = llm_model
        self._quality_threshold = quality_threshold

    async def curate_note(
        self,
        filename: str,
        *,
        method: str = "auto",
        extra_tags: Optional[List[str]] = None,
        use_llm: bool = True,
    ) -> CurationResult:
        """Run the full 5-stage curation pipeline on a single User Opsidian note.

        Args:
            filename: Source note filename in User Opsidian.
            method: "auto" (let LLM decide), or force one of:
                    direct, summary, extract, merge, restructure, skip.
            extra_tags: Additional tags to apply.
            use_llm: Whether to use LLM for analysis/transform.
                     If False, uses rule-based fallbacks.

        Returns:
            CurationResult with outcome details.
        """
        if self._opsidian is None:
            return CurationResult(success=False, reason="No User Opsidian manager")

        # ── Stage 1: Triage ──
        note = self._opsidian.read_note(filename)
        if note is None:
            return CurationResult(success=False, reason=f"Note not found: {filename}")

        meta = note.get("metadata") or {}
        body = note.get("body") or ""

        triage = CurationTriage.triage(meta, body)
        logger.info(
            "Curation triage for '%s': action=%s reason=%s",
            filename, triage["action"], triage["reason"],
        )

        if triage["action"] == "exclude":
            return CurationResult(success=False, reason=triage["reason"])

        # ── Stage 2: LLM Analysis ──
        analysis = None
        if use_llm and self._llm and method == "auto":
            analysis = await self._llm_analyze(note)
            if analysis and not analysis.get("should_curate", True):
                return CurationResult(
                    success=False,
                    reason="LLM decided to skip",
                    quality_score=analysis.get("quality_score"),
                    analysis=analysis,
                )
            if analysis:
                quality = analysis.get("quality_score", 0.0)
                if quality < self._quality_threshold:
                    return CurationResult(
                        success=False,
                        reason=f"Quality {quality:.2f} below threshold {self._quality_threshold}",
                        quality_score=quality,
                        analysis=analysis,
                    )
                if method == "auto":
                    method = analysis.get("curation_strategy", "direct")

        # Fallback: if no LLM or auto not resolved
        if method == "auto":
            method = "direct" if triage["action"] == "auto_curate" else "summary"

        # ── Stage 3: Transform ──
        transformed_content = await self._transform(note, method, analysis)

        # ── Stage 4: Enrich ──
        enrichment = await self._enrich(transformed_content, analysis)

        # ── Stage 5: Store ──
        # Determine metadata
        title = meta.get("title", filename.replace(".md", ""))
        if analysis and analysis.get("suggested_title"):
            title = analysis["suggested_title"]
        if enrichment and enrichment.get("title_improvement"):
            title = enrichment["title_improvement"]

        category = meta.get("category", "topics")
        if analysis and analysis.get("suggested_category"):
            category = analysis["suggested_category"]

        importance = meta.get("importance", "medium")
        if analysis and analysis.get("suggested_importance"):
            importance = analysis["suggested_importance"]
        if enrichment and enrichment.get("importance_assessment"):
            importance = enrichment["importance_assessment"]

        tags = list(meta.get("tags") or [])
        if analysis and analysis.get("suggested_tags"):
            tags = list(set(tags + analysis["suggested_tags"]))
        if enrichment and enrichment.get("auto_tags"):
            tags = list(set(tags + enrichment["auto_tags"]))
        if extra_tags:
            tags = list(set(tags + extra_tags))

        links_to = None
        if enrichment and enrichment.get("suggested_links"):
            links_to = enrichment["suggested_links"]

        curated_fn = self._curated.write_note(
            title=title,
            content=transformed_content,
            category=category,
            tags=tags,
            importance=importance,
            source="auto-curated",
            links_to=links_to,
            source_filename=filename,
        )

        if curated_fn is None:
            return CurationResult(success=False, reason="Failed to write curated note")

        quality_score = analysis.get("quality_score") if analysis else None

        logger.info(
            "Curation complete: '%s' → '%s' (method=%s, quality=%s)",
            filename, curated_fn, method,
            f"{quality_score:.2f}" if quality_score is not None else "n/a",
        )

        return CurationResult(
            success=True,
            curated_filename=curated_fn,
            method_used=method,
            quality_score=quality_score,
            analysis=analysis,
        )

    async def curate_batch(
        self,
        filenames: List[str],
        *,
        use_llm: bool = True,
    ) -> List[CurationResult]:
        """Curate multiple notes sequentially."""
        results = []
        for fn in filenames:
            result = await self.curate_note(fn, use_llm=use_llm)
            results.append(result)
        return results

    # ── Stage 2: LLM Analysis ─────────────────────────────────────

    async def _llm_analyze(self, note: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Run LLM-based quality assessment."""
        if self._llm is None:
            return None

        meta = note.get("metadata") or {}
        body = note.get("body") or ""

        # Build existing index summary for context
        existing_index = ""
        try:
            idx = self._curated.get_index()
            if idx and idx.get("files"):
                entries = []
                for fn, info in list(idx["files"].items())[:20]:
                    entries.append(f"- {fn}: {info.get('title', '?')} [{info.get('category', '?')}]")
                existing_index = "\n".join(entries)
        except Exception:
            pass

        prompt = _CURATION_ANALYSIS_PROMPT.format(
            title=meta.get("title", ""),
            category=meta.get("category", ""),
            tags=", ".join(meta.get("tags") or []),
            importance=meta.get("importance", "medium"),
            body=body[:3000],  # Truncate long bodies
            existing_index=existing_index or "(empty)",
        )

        try:
            from langchain_core.messages import HumanMessage
            response = await self._llm.ainvoke([HumanMessage(content=prompt)])
            text = response.content if hasattr(response, "content") else str(response)

            # Parse JSON from response
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.warning("Curation analysis: JSON parse failed: %s", e)
            return None
        except Exception as e:
            logger.warning("Curation analysis: LLM call failed: %s", e)
            return None

    # ── Stage 3: Transform ────────────────────────────────────────

    async def _transform(
        self,
        note: Dict[str, Any],
        method: str,
        analysis: Optional[Dict[str, Any]],
    ) -> str:
        """Transform note content according to the chosen strategy."""
        meta = note.get("metadata") or {}
        body = note.get("body") or ""
        title = meta.get("title", "")

        # If no LLM or method is "direct", return body as-is (with minor cleanup)
        if method == "direct" or self._llm is None:
            return body.strip()

        # Select prompt template
        if method == "summary":
            prompt = _TRANSFORM_SUMMARY_PROMPT.format(
                title=title,
                body=body[:4000],
                target_chars=min(len(body), 2000),
            )
        elif method == "extract":
            prompt = _TRANSFORM_EXTRACT_PROMPT.format(
                title=title,
                body=body[:4000],
            )
        elif method == "restructure":
            prompt = _TRANSFORM_RESTRUCTURE_PROMPT.format(
                title=title,
                body=body[:4000],
            )
        elif method == "merge":
            # Merge requires fetching related notes
            merge_content = await self._build_merge_content(note, analysis)
            prompt = _TRANSFORM_MERGE_PROMPT.format(notes_xml=merge_content)
        else:
            # Fallback: direct copy
            return body.strip()

        try:
            from langchain_core.messages import HumanMessage
            response = await self._llm.ainvoke([HumanMessage(content=prompt)])
            text = response.content if hasattr(response, "content") else str(response)
            return text.strip()
        except Exception as e:
            logger.warning("Curation transform (%s) failed: %s", method, e)
            return body.strip()  # Fallback to original

    async def _build_merge_content(
        self,
        note: Dict[str, Any],
        analysis: Optional[Dict[str, Any]],
    ) -> str:
        """Build XML content for merge transform, combining source + candidates."""
        meta = note.get("metadata") or {}
        body = note.get("body") or ""
        title = meta.get("title", "untitled")

        parts = [
            f'<note title="{title}" source="new">\n{body[:3000]}\n</note>'
        ]

        # Fetch merge candidates from analysis
        candidates = []
        if analysis and analysis.get("merge_candidates"):
            candidates = analysis["merge_candidates"]

        for fn in candidates[:3]:  # Limit merge targets
            existing = self._curated.read_note(fn)
            if existing:
                ex_body = existing.get("body") or ""
                ex_title = (existing.get("metadata") or {}).get("title", fn)
                parts.append(
                    f'<note title="{ex_title}" source="existing:{fn}">\n'
                    f'{ex_body[:3000]}\n</note>'
                )

        return "\n\n".join(parts)

    # ── Stage 4: Enrich ───────────────────────────────────────────

    async def _enrich(
        self,
        content: str,
        analysis: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """Auto-enrich curated note with tags and link suggestions."""
        if self._llm is None:
            return None

        # Build existing index summary
        existing_summary = ""
        try:
            idx = self._curated.get_index()
            if idx and idx.get("files"):
                entries = []
                for fn, info in list(idx["files"].items())[:15]:
                    tags_str = ", ".join(info.get("tags", [])[:3])
                    entries.append(f"- {fn}: {info.get('title', '?')} [{tags_str}]")
                existing_summary = "\n".join(entries)
        except Exception:
            pass

        prompt = _ENRICH_PROMPT.format(
            curated_content=content[:3000],
            existing_index_summary=existing_summary or "(empty)",
        )

        try:
            from langchain_core.messages import HumanMessage
            response = await self._llm.ainvoke([HumanMessage(content=prompt)])
            text = response.content if hasattr(response, "content") else str(response)
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            return json.loads(text)
        except Exception as e:
            logger.warning("Curation enrich failed: %s", e)
            return None
