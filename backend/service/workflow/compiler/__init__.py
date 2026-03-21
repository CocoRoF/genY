"""
Sudo Compiler — dry-run workflow executor for graph testing.

Replaces all LLM calls with deterministic mock responses,
allowing full graph traversal verification without API costs.

Usage::

    from service.workflow.compiler import SudoCompiler

    compiler = SudoCompiler(workflow_definition)
    report  = await compiler.run("test input")
    print(report.summary())
"""

from service.workflow.compiler.compiler import SudoCompiler
from service.workflow.compiler.model import SudoModel
from service.workflow.compiler.report import SudoRunReport

__all__ = ["SudoCompiler", "SudoModel", "SudoRunReport"]
