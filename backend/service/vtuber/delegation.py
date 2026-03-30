"""
Delegation Protocol
===================

Defines the structured message format for VTuber ↔ CLI agent
delegation and response reporting.

Tags:
  [DELEGATION_REQUEST]   — VTuber → CLI: task assignment
  [DELEGATION_RESULT]    — CLI → VTuber: task completion report
  [THINKING_TRIGGER]     — System → VTuber: idle thinking
  [CLI_RESULT]           — System → VTuber: CLI finished (auto-report)

Loop Prevention:
  Messages tagged with [DELEGATION_RESULT] or [CLI_RESULT] are
  classified as "thinking" by VTuberClassifyNode and never
  re-delegated.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional


class DelegationTag(str, Enum):
    """Standard message tags for inter-agent communication."""
    REQUEST = "[DELEGATION_REQUEST]"
    RESULT = "[DELEGATION_RESULT]"
    THINKING = "[THINKING_TRIGGER]"
    CLI_RESULT = "[CLI_RESULT]"


@dataclass
class DelegationMessage:
    """Structured delegation message between VTuber and CLI agents."""
    tag: DelegationTag
    sender_session_id: str
    target_session_id: str
    content: str
    task_id: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def format(self) -> str:
        """Format as a string for DM delivery."""
        parts = [
            f"{self.tag.value}",
            f"From: {self.sender_session_id}",
        ]
        if self.task_id:
            parts.append(f"Task: {self.task_id}")
        parts.append(f"\n{self.content}")
        return "\n".join(parts)

    @staticmethod
    def is_delegation_message(text: str) -> bool:
        """Check if a message is a delegation protocol message."""
        return any(text.startswith(tag.value) for tag in DelegationTag)

    @staticmethod
    def is_result_message(text: str) -> bool:
        """Check if a message is a result/report (should not be re-delegated)."""
        return (
            text.startswith(DelegationTag.RESULT.value)
            or text.startswith(DelegationTag.CLI_RESULT.value)
        )

    @staticmethod
    def is_thinking_trigger(text: str) -> bool:
        """Check if a message is a thinking trigger."""
        return text.startswith(DelegationTag.THINKING.value)


def format_delegation_request(
    sender_id: str,
    target_id: str,
    task: str,
    task_id: Optional[str] = None,
) -> str:
    """Create a formatted delegation request message."""
    msg = DelegationMessage(
        tag=DelegationTag.REQUEST,
        sender_session_id=sender_id,
        target_session_id=target_id,
        content=task,
        task_id=task_id,
    )
    return msg.format()


def format_delegation_result(
    sender_id: str,
    target_id: str,
    result: str,
    task_id: Optional[str] = None,
) -> str:
    """Create a formatted delegation result message."""
    msg = DelegationMessage(
        tag=DelegationTag.RESULT,
        sender_session_id=sender_id,
        target_session_id=target_id,
        content=result,
        task_id=task_id,
    )
    return msg.format()
