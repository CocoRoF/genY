"""
SudoRunReport — structured results from a sudo-compiler dry run.

Captures every node execution, routing decision, state transition,
and timing detail so that the caller can inspect exactly how the
graph would behave without any real LLM calls.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class NodeExecution:
    """Record of a single node execution during one sudo run."""

    node_id: str
    node_type: str
    label: str
    iteration: int
    duration_ms: int
    state_updates: Dict[str, Any]
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "node_id": self.node_id,
            "node_type": self.node_type,
            "label": self.label,
            "iteration": self.iteration,
            "duration_ms": self.duration_ms,
            "state_updates_keys": list(self.state_updates.keys()),
            "error": self.error,
        }


@dataclass
class EdgeDecision:
    """Record of a routing decision between nodes."""

    from_node: str
    decision: str
    to_node: str
    iteration: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "from_node": self.from_node,
            "decision": self.decision,
            "to_node": self.to_node,
            "iteration": self.iteration,
        }


@dataclass
class SudoRunReport:
    """Complete results of a sudo-compiler dry run.

    Collects node executions, edge decisions, the final state,
    LLM call log, and any errors encountered.
    """

    workflow_name: str
    workflow_id: str
    input_text: str
    success: bool = False
    error: Optional[str] = None
    total_duration_ms: int = 0
    node_executions: List[NodeExecution] = field(default_factory=list)
    edge_decisions: List[EdgeDecision] = field(default_factory=list)
    final_state: Dict[str, Any] = field(default_factory=dict)
    llm_call_log: List[Dict[str, Any]] = field(default_factory=list)
    total_mock_cost: float = 0.0
    node_visit_order: List[str] = field(default_factory=list)

    # ── Computed properties ──

    @property
    def total_nodes_executed(self) -> int:
        return len(self.node_executions)

    @property
    def total_llm_calls(self) -> int:
        return len(self.llm_call_log)

    @property
    def unique_nodes_visited(self) -> int:
        return len(set(self.node_visit_order))

    @property
    def has_errors(self) -> bool:
        return self.error is not None or any(
            n.error for n in self.node_executions
        )

    @property
    def path_string(self) -> str:
        """Human-readable node traversal path."""
        return " → ".join(self.node_visit_order) if self.node_visit_order else "(empty)"

    # ── Output methods ──

    def summary(self) -> str:
        """Human-readable summary of the sudo run."""
        lines = [
            f"═══ Sudo Run Report: {self.workflow_name} ═══",
            f"Status:           {'✅ SUCCESS' if self.success else '❌ FAILED'}",
            f"Input:            {self.input_text[:80]}{'…' if len(self.input_text) > 80 else ''}",
            f"Duration:         {self.total_duration_ms}ms",
            f"Nodes executed:   {self.total_nodes_executed}",
            f"Unique nodes:     {self.unique_nodes_visited}",
            f"LLM calls:        {self.total_llm_calls}",
            f"Mock cost:        ${self.total_mock_cost:.6f}",
            f"Path:             {self.path_string}",
        ]

        if self.error:
            lines.append(f"Error:            {self.error}")

        # Edge decisions
        if self.edge_decisions:
            lines.append("")
            lines.append("─── Routing Decisions ───")
            for ed in self.edge_decisions:
                lines.append(f"  {ed.from_node} ──[{ed.decision}]──▶ {ed.to_node}")

        # Node errors
        node_errors = [n for n in self.node_executions if n.error]
        if node_errors:
            lines.append("")
            lines.append("─── Node Errors ───")
            for ne in node_errors:
                lines.append(f"  ⚠ {ne.label} ({ne.node_id}): {ne.error}")

        # Final state highlights
        lines.append("")
        lines.append("─── Final State ───")
        highlight_keys = [
            "is_complete", "final_answer", "difficulty", "answer",
            "review_result", "review_count", "total_cost", "error",
            "completion_signal", "iteration", "relevance_skipped",
        ]
        for k in highlight_keys:
            if k in self.final_state:
                v = self.final_state[k]
                if isinstance(v, str) and len(v) > 100:
                    v = v[:100] + "…"
                lines.append(f"  {k}: {v}")

        lines.append("═" * (len(lines[0])))
        return "\n".join(lines)

    def to_dict(self) -> Dict[str, Any]:
        """Full serialization for JSON export."""
        # Sanitize final_state: convert non-serializable objects
        safe_state = {}
        for k, v in self.final_state.items():
            if k == "messages":
                safe_state[k] = f"[{len(v)} messages]" if isinstance(v, list) else str(v)
            elif isinstance(v, (str, int, float, bool, type(None))):
                safe_state[k] = v
            elif isinstance(v, list):
                safe_state[k] = [
                    item if isinstance(item, (str, int, float, bool, dict, type(None)))
                    else str(item)
                    for item in v
                ]
            elif isinstance(v, dict):
                safe_state[k] = v
            else:
                safe_state[k] = str(v)

        return {
            "workflow_name": self.workflow_name,
            "workflow_id": self.workflow_id,
            "input_text": self.input_text,
            "success": self.success,
            "error": self.error,
            "total_duration_ms": self.total_duration_ms,
            "total_nodes_executed": self.total_nodes_executed,
            "total_llm_calls": self.total_llm_calls,
            "unique_nodes_visited": self.unique_nodes_visited,
            "total_mock_cost": self.total_mock_cost,
            "path": self.node_visit_order,
            "path_string": self.path_string,
            "node_executions": [n.to_dict() for n in self.node_executions],
            "edge_decisions": [e.to_dict() for e in self.edge_decisions],
            "llm_call_log": self.llm_call_log,
            "final_state": safe_state,
        }

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)
