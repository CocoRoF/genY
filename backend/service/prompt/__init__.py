"""
Prompt Builder System

Implements a structured prompt builder suitable for the Geny Agent,
inspired by OpenClaw's 25+ section modular prompt design.

Usage example:
    from service.prompt import PromptBuilder, PromptMode

    builder = PromptBuilder(mode=PromptMode.FULL)
    prompt = (builder
        .add_identity("DevWorker", role=SessionRole.WORKER)
        .add_capabilities(tools=["read_file", "write_file"])
        .add_safety_guidelines()
        .add_execution_protocol()
        .add_completion_protocol()
        .add_runtime_line(model="claude-sonnet-4", session_id="abc")
        .build())
"""

from service.prompt.builder import PromptBuilder, PromptMode, PromptSection
from service.prompt.sections import SectionLibrary
from service.prompt.protocols import ExecutionProtocol, CompletionProtocol, ErrorRecoveryProtocol
from service.prompt.context_loader import ContextLoader

__all__ = [
    "PromptBuilder",
    "PromptMode",
    "PromptSection",
    "SectionLibrary",
    "ExecutionProtocol",
    "CompletionProtocol",
    "ErrorRecoveryProtocol",
    "ContextLoader",
]
