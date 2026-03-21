"""
SudoCompiler — dry-run workflow executor for graph validation.

Compiles a ``WorkflowDefinition`` into a LangGraph StateGraph with
all LLM calls replaced by ``SudoModel`` mock responses.  Runs the
full graph end-to-end and produces a ``SudoRunReport`` with:

    • Every node execution (order, duration, state updates)
    • Every routing decision (conditional edge choices)
    • The complete final state
    • A log of every mock LLM call
    • Success / failure status

This is the primary tool for validating that a workflow graph
is structurally correct — all edges connect, all routing decisions
produce valid port names, and every node can execute without errors.

Usage::

    from service.workflow.compiler import SudoCompiler

    compiler = SudoCompiler(workflow_def)
    report = await compiler.run("Tell me about Python")
    print(report.summary())

    # Force a specific classification path:
    compiler = SudoCompiler(workflow_def, overrides={"classify": "hard"})
    report = await compiler.run("Complex task")

    # Run all paths automatically:
    reports = await SudoCompiler.run_all_paths(workflow_def, "Test input")
    for r in reports:
        print(r.path_string, "✅" if r.success else "❌")
"""

from __future__ import annotations

import time
from logging import getLogger
from typing import Any, Dict, List, Optional

from service.workflow.compiler.model import SudoModel
from service.workflow.compiler.report import (
    EdgeDecision,
    NodeExecution,
    SudoRunReport,
)

logger = getLogger(__name__)


class _SudoSessionLogger:
    """Minimal session logger that captures events for the report.

    Implements the same interface expected by ``WorkflowExecutor._make_node_function``.
    """

    def __init__(self, report: SudoRunReport) -> None:
        self._report = report
        self._cache: List[str] = []

    def log_graph_node_enter(self, *, node_name: str, iteration: int,
                             state_summary: Any = None) -> None:
        self._cache.append(f"[enter] {node_name} iter={iteration}")

    def log_graph_node_exit(self, *, node_name: str, iteration: int,
                            output_preview: Any = None, duration_ms: int = 0,
                            state_changes: Any = None) -> None:
        self._cache.append(
            f"[exit] {node_name} iter={iteration} {duration_ms}ms"
        )

    def log_graph_edge_decision(self, *, from_node: str, decision: str,
                                iteration: int = 0) -> None:
        # Parse "decision → target" format used by WorkflowExecutor
        parts = decision.split(" → ", 1)
        decision_label = parts[0].strip()
        to_node = parts[1].strip() if len(parts) > 1 else decision_label

        self._report.edge_decisions.append(EdgeDecision(
            from_node=from_node,
            decision=decision_label,
            to_node=to_node,
            iteration=iteration,
        ))

    def log_graph_error(self, *, error_message: str, node_name: str = "",
                        iteration: int = 0, error_type: str = "") -> None:
        self._cache.append(f"[error] {node_name}: {error_message[:200]}")

    def log_graph_execution_complete(self, **kwargs: Any) -> None:
        pass

    def log_command(self, **kwargs: Any) -> None:
        pass

    def log_response(self, **kwargs: Any) -> None:
        pass

    def get_cache_length(self) -> int:
        return len(self._cache)


class _SudoMemoryManager:
    """Stub memory manager — returns no memory content.

    Nodes like ``memory_inject`` check for ``context.memory_manager``
    and skip if ``None``.  This stub lets the gate LLM call happen
    but returns no actual memory.
    """

    class _ShortTerm:
        def get_summary(self) -> Optional[str]:
            return None

    class _LongTerm:
        def load_main(self) -> None:
            return None

    def __init__(self) -> None:
        self.short_term = self._ShortTerm()
        self.long_term = self._LongTerm()
        self.vector_memory = None

    def search(self, query: str, **kwargs: Any) -> list:
        return []


class SudoCompiler:
    """Compile and dry-run a workflow with mock LLM calls.

    Args:
        workflow:       The workflow definition to test.
        seed:           Random seed for reproducible runs.
        overrides:      Per-node response overrides
                        (e.g. ``{"classify": "hard"}`` to force hard path).
        categories:     Override classify categories.
        verdicts:       Override review verdicts.
        max_iterations: Maximum graph iterations (safety limit).
        latency_ms:     Simulated per-call latency.
    """

    def __init__(
        self,
        workflow: Any,   # WorkflowDefinition
        *,
        seed: int = 42,
        overrides: Optional[Dict[str, str]] = None,
        categories: Optional[List[str]] = None,
        verdicts: Optional[List[str]] = None,
        max_iterations: int = 50,
        latency_ms: int = 0,
    ) -> None:
        self._workflow = workflow
        self._seed = seed
        self._overrides = overrides or {}
        self._categories = categories
        self._verdicts = verdicts
        self._max_iterations = max_iterations
        self._latency_ms = latency_ms

    async def run(self, input_text: str = "Test input for sudo run") -> SudoRunReport:
        """Execute the workflow graph with mock LLM and return a report.

        Returns:
            SudoRunReport with full execution details.
        """
        from service.workflow.nodes.base import ExecutionContext, get_node_registry
        from service.workflow.workflow_executor import WorkflowExecutor

        report = SudoRunReport(
            workflow_name=self._workflow.name,
            workflow_id=self._workflow.id,
            input_text=input_text,
        )

        # Build mock model
        model = SudoModel(
            seed=self._seed,
            overrides=self._overrides,
            categories=self._categories,
            verdicts=self._verdicts,
            latency_ms=self._latency_ms,
        )

        # Build mock execution context
        sudo_logger = _SudoSessionLogger(report)
        context = ExecutionContext(
            model=model,
            session_id="sudo-session",
            memory_manager=_SudoMemoryManager(),
            session_logger=sudo_logger,
            context_guard=None,
            max_retries=0,       # No retries in sudo mode
            model_name="sudo-model",
        )

        start_time = time.time()

        try:
            # Compile the graph
            registry = get_node_registry()
            executor = WorkflowExecutor(self._workflow, context, registry)

            # Patch the node function wrapper to capture executions
            original_make = executor._make_node_function
            executor._make_node_function = lambda bn, inst: self._wrap_node_fn(
                original_make, bn, inst, report
            )

            graph = executor.compile()

            # Run the graph
            from service.langgraph.state import make_initial_autonomous_state
            initial_state = make_initial_autonomous_state(
                input_text,
                max_iterations=self._max_iterations,
            )

            final_state = await graph.ainvoke(initial_state)
            final_dict = dict(final_state)

            duration_ms = int((time.time() - start_time) * 1000)

            report.success = True
            report.total_duration_ms = duration_ms
            report.final_state = final_dict
            report.llm_call_log = model.call_log
            report.total_mock_cost = final_dict.get("total_cost", 0.0)

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            report.success = False
            report.error = f"{type(e).__name__}: {str(e)}"
            report.total_duration_ms = duration_ms
            report.llm_call_log = model.call_log
            logger.error(f"[sudo] Run failed: {e}", exc_info=True)

        return report

    def _wrap_node_fn(self, original_make, base_node, instance, report):
        """Wrap the node function to capture execution details."""
        node_fn = original_make(base_node, instance)

        node_id = instance.id
        node_type = instance.node_type
        label = instance.label or instance.node_type

        async def _traced_fn(state):
            iteration = state.get("iteration", 0)
            start = time.time()
            error_str = None

            try:
                result = await node_fn(state)
                return result
            except Exception as e:
                error_str = f"{type(e).__name__}: {str(e)}"
                raise
            finally:
                duration_ms = int((time.time() - start) * 1000)
                report.node_executions.append(NodeExecution(
                    node_id=node_id,
                    node_type=node_type,
                    label=label,
                    iteration=iteration,
                    duration_ms=duration_ms,
                    state_updates=result if error_str is None else {},
                    error=error_str,
                ))
                report.node_visit_order.append(label)

        _traced_fn.__name__ = f"sudo_{node_id}_{node_type}"
        _traced_fn.__qualname__ = _traced_fn.__name__
        return _traced_fn

    # ── Class-level utilities ──

    @staticmethod
    async def run_all_paths(
        workflow: Any,
        input_text: str = "Test input for sudo run",
        *,
        max_iterations: int = 50,
    ) -> List[SudoRunReport]:
        """Run the workflow through all possible classify paths.

        Automatically detects classify/adaptive_classify nodes,
        reads their configured categories, and runs the graph once
        per category to ensure every routing path is valid.

        Returns:
            List of SudoRunReport, one per path.
        """
        # Detect classifiable categories from the workflow
        categories = _detect_categories(workflow)
        if not categories:
            # No classify node — single run
            compiler = SudoCompiler(workflow, max_iterations=max_iterations)
            return [await compiler.run(input_text)]

        reports = []
        for cat in categories:
            compiler = SudoCompiler(
                workflow,
                overrides={"classify": cat, "adaptive_classify": cat},
                seed=hash(cat) & 0xFFFFFFFF,
                max_iterations=max_iterations,
            )
            report = await compiler.run(input_text)
            reports.append(report)

        return reports

    @staticmethod
    async def validate(
        workflow: Any,
        input_text: str = "Test input for sudo run",
    ) -> Dict[str, Any]:
        """Quick validation: run all paths and return pass/fail summary.

        Returns:
            Dict with ``valid`` (bool), ``paths`` (list of dicts),
            ``errors`` (list of error strings).
        """
        reports = await SudoCompiler.run_all_paths(workflow, input_text)

        paths = []
        errors = []

        for r in reports:
            path_info = {
                "path": r.path_string,
                "success": r.success,
                "nodes_executed": r.total_nodes_executed,
                "llm_calls": r.total_llm_calls,
            }
            if r.error:
                path_info["error"] = r.error
                errors.append(f"Path [{r.path_string}]: {r.error}")
            paths.append(path_info)

        return {
            "valid": all(r.success for r in reports),
            "total_paths": len(reports),
            "paths": paths,
            "errors": errors,
        }


def _detect_categories(workflow: Any) -> List[str]:
    """Extract classification categories from the workflow definition."""
    from service.workflow.nodes.base import get_node_registry

    registry = get_node_registry()
    categories = set()

    for node in workflow.nodes:
        if node.node_type in ("classify", "adaptive_classify"):
            # Check config for explicit categories
            config_cats = node.config.get("categories")
            if config_cats and isinstance(config_cats, list):
                categories.update(config_cats)
            else:
                # Fall back to default categories from the base node
                base = registry.get(node.node_type)
                if base:
                    ports = base.output_ports
                    dynamic = base.get_dynamic_output_ports(node.config)
                    if dynamic:
                        ports = dynamic
                    for port in ports:
                        if port.id not in ("default", "end"):
                            categories.add(port.id)

    # If we still have nothing, use defaults
    if not categories:
        categories = {"easy", "medium", "hard"}

    return sorted(categories)
