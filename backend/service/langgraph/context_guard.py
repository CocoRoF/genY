"""
컨텍스트 윈도우 가드 시스템

OpenClaw의 컨텍스트 관리 패턴을 참고하여 구축.
대화가 길어짐에 따라 컨텍스트 윈도우 초과를 방지합니다.

핵심 설계:
- 토큰 수 추정 (정확한 토큰화 없이 문자/단어 기반 휴리스틱)
- Warn / Block 임계값 기반 2단계 경고
- 임계값 도달 시 컴팩션 전략 제안 또는 자동 적용
- LangGraph 상태와 통합 가능

사용법:
    guard = ContextWindowGuard(
        model="claude-sonnet-4-20250514",
        warn_ratio=0.75,
        block_ratio=0.90,
    )

    # 메시지 추가 시마다 체크
    status = guard.check(messages)
    if status.should_block:
        # 실행 중단 또는 컴팩션
        messages = guard.compact(messages)
    elif status.should_warn:
        # 경고 로그
        logger.warning(status.message)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from logging import getLogger
from typing import Any, Dict, List, Optional, Tuple

logger = getLogger(__name__)


# ============================================================================
# Model Context Limits
# ============================================================================

# Claude 모델별 컨텍스트 윈도우 크기 (토큰)
MODEL_CONTEXT_LIMITS: Dict[str, int] = {
    # Claude 4.6
    "claude-opus-4-6": 200_000,
    "claude-sonnet-4-6": 200_000,
    # Claude 4.5
    "claude-opus-4-5-20251101": 200_000,
    "claude-sonnet-4-5-20250929": 200_000,
    "claude-haiku-4-5-20251001": 200_000,
    # Claude 4
    "claude-opus-4-20250514": 200_000,
    "claude-sonnet-4-20250514": 200_000,
    "claude-sonnet-4-20250715": 200_000,
    "claude-haiku-4-20250414": 200_000,
    # Legacy
    "claude-3-5-sonnet-20241022": 200_000,
    "claude-3-5-haiku-20241022": 200_000,
    "claude-3-opus-20240229": 200_000,
    "claude-3-sonnet-20240229": 200_000,
    "claude-3-haiku-20240307": 200_000,
}

# 모델명 인식 실패 시 기본값
DEFAULT_CONTEXT_LIMIT = 200_000

# 토큰 추정 상수
# 영어: ~4 chars/token, 한국어: ~2-3 chars/token
# 보수적으로 3 chars/token 사용
CHARS_PER_TOKEN_ESTIMATE = 3.0


def get_context_limit(model: Optional[str]) -> int:
    """모델의 컨텍스트 윈도우 크기를 반환."""
    if not model:
        return DEFAULT_CONTEXT_LIMIT

    # 정확한 이름 매치
    if model in MODEL_CONTEXT_LIMITS:
        return MODEL_CONTEXT_LIMITS[model]

    # 부분 매치 (모델명에 키워드가 포함된 경우)
    model_lower = model.lower()
    for key, limit in MODEL_CONTEXT_LIMITS.items():
        if key in model_lower or model_lower in key:
            return limit

    return DEFAULT_CONTEXT_LIMIT


def estimate_tokens(text: str) -> int:
    """텍스트의 토큰 수를 추정.

    정확한 토큰화 없이 문자 수 기반 휴리스틱으로 추정합니다.
    보수적으로 추정하여 오버플로우를 방지합니다.
    """
    if not text:
        return 0
    return max(1, int(len(text) / CHARS_PER_TOKEN_ESTIMATE))


def estimate_messages_tokens(messages: List[Dict[str, Any]]) -> int:
    """메시지 리스트의 총 토큰 수를 추정.

    각 메시지의 role, content, tool_calls 등을 합산합니다.
    메시지 오버헤드(role tag 등)도 포함합니다.
    """
    total = 0
    for msg in messages:
        # 메시지 오버헤드 (~4 tokens for role tag)
        total += 4

        # content
        content = msg.get("content", "")
        if isinstance(content, str):
            total += estimate_tokens(content)
        elif isinstance(content, list):
            # 멀티모달 content (text blocks)
            for block in content:
                if isinstance(block, dict):
                    total += estimate_tokens(block.get("text", ""))
                elif isinstance(block, str):
                    total += estimate_tokens(block)

        # tool_calls / tool_use
        tool_calls = msg.get("tool_calls") or msg.get("additional_kwargs", {}).get("tool_calls", [])
        if tool_calls:
            for tc in tool_calls:
                total += estimate_tokens(str(tc))

    return total


# ============================================================================
# Guard Status
# ============================================================================

class ContextStatus(str, Enum):
    """컨텍스트 상태."""
    OK = "ok"           # 정상
    WARN = "warn"       # 경고 임계값 도달
    BLOCK = "block"     # 차단 임계값 도달
    OVERFLOW = "overflow"  # 이미 초과


@dataclass
class ContextCheckResult:
    """컨텍스트 체크 결과."""
    status: ContextStatus
    estimated_tokens: int
    context_limit: int
    usage_ratio: float
    message: str = ""

    @property
    def should_warn(self) -> bool:
        return self.status in (ContextStatus.WARN, ContextStatus.BLOCK, ContextStatus.OVERFLOW)

    @property
    def should_block(self) -> bool:
        return self.status in (ContextStatus.BLOCK, ContextStatus.OVERFLOW)

    @property
    def remaining_tokens(self) -> int:
        return max(0, self.context_limit - self.estimated_tokens)


# ============================================================================
# Compaction Strategies
# ============================================================================

class CompactionStrategy(str, Enum):
    """컨텍스트 컴팩션 전략."""
    TRUNCATE_EARLY = "truncate_early"       # 초기 메시지 제거
    SUMMARIZE_PREFIX = "summarize_prefix"    # 초기 부분 요약
    KEEP_RECENT = "keep_recent"             # 최근 N개만 유지
    REMOVE_TOOL_DETAILS = "remove_tool_details"  # 도구 호출 상세 제거


def compact_messages(
    messages: List[Dict[str, Any]],
    strategy: CompactionStrategy = CompactionStrategy.KEEP_RECENT,
    keep_count: int = 10,
    keep_system: bool = True,
) -> List[Dict[str, Any]]:
    """메시지를 컴팩션하여 컨텍스트를 줄임.

    Args:
        messages: 원본 메시지 리스트
        strategy: 컴팩션 전략
        keep_count: 유지할 최근 메시지 수
        keep_system: 시스템 메시지를 항상 유지할지 여부

    Returns:
        컴팩션된 메시지 리스트
    """
    if not messages:
        return messages

    if strategy == CompactionStrategy.KEEP_RECENT:
        return _compact_keep_recent(messages, keep_count, keep_system)
    elif strategy == CompactionStrategy.TRUNCATE_EARLY:
        return _compact_truncate_early(messages, keep_count, keep_system)
    elif strategy == CompactionStrategy.REMOVE_TOOL_DETAILS:
        return _compact_remove_tool_details(messages)
    else:
        # 기본: KEEP_RECENT
        return _compact_keep_recent(messages, keep_count, keep_system)


def _compact_keep_recent(
    messages: List[Dict[str, Any]],
    keep_count: int,
    keep_system: bool,
) -> List[Dict[str, Any]]:
    """최근 N개 메시지만 유지."""
    result = []

    # 시스템 메시지 추출
    if keep_system:
        for msg in messages:
            if msg.get("role") == "system":
                result.append(msg)

    # 최근 메시지 추가
    non_system = [m for m in messages if m.get("role") != "system"]
    recent = non_system[-keep_count:] if len(non_system) > keep_count else non_system

    # 요약 마커 삽입
    if len(non_system) > keep_count:
        removed_count = len(non_system) - keep_count
        result.append({
            "role": "system",
            "content": (
                f"[Context compacted: {removed_count} earlier messages removed. "
                f"Showing most recent {keep_count} messages.]"
            )
        })

    result.extend(recent)
    return result


def _compact_truncate_early(
    messages: List[Dict[str, Any]],
    keep_count: int,
    keep_system: bool,
) -> List[Dict[str, Any]]:
    """초기 메시지를 잘라냄 (시스템 메시지 + 최근 N개 유지)."""
    # KEEP_RECENT와 동일하지만 요약 마커가 다름
    result = []

    if keep_system:
        for msg in messages:
            if msg.get("role") == "system":
                result.append(msg)

    non_system = [m for m in messages if m.get("role") != "system"]
    recent = non_system[-keep_count:] if len(non_system) > keep_count else non_system

    if len(non_system) > keep_count:
        result.append({
            "role": "system",
            "content": "[Earlier conversation context truncated to fit context window.]"
        })

    result.extend(recent)
    return result


def _compact_remove_tool_details(
    messages: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """도구 호출 결과의 상세 내용을 축소."""
    result = []
    for msg in messages:
        msg_copy = dict(msg)

        # tool result 메시지의 content를 축소
        if msg_copy.get("role") == "tool":
            content = msg_copy.get("content", "")
            if isinstance(content, str) and len(content) > 500:
                msg_copy["content"] = content[:200] + "\n...[truncated]...\n" + content[-200:]

        result.append(msg_copy)

    return result


# ============================================================================
# Context Window Guard
# ============================================================================

class ContextWindowGuard:
    """컨텍스트 윈도우 가드.

    대화 길이를 모니터링하고 오버플로우를 방지합니다.

    사용법:
        guard = ContextWindowGuard(model="claude-sonnet-4-20250514")

        # 메시지 체크
        result = guard.check(messages)
        if result.should_block:
            messages = guard.auto_compact(messages)
        elif result.should_warn:
            logger.warning(result.message)
    """

    def __init__(
        self,
        model: Optional[str] = None,
        context_limit: Optional[int] = None,
        warn_ratio: float = 0.75,
        block_ratio: float = 0.90,
        auto_compact_strategy: CompactionStrategy = CompactionStrategy.KEEP_RECENT,
        auto_compact_keep_count: int = 20,
    ):
        """
        Args:
            model: 모델명 (context_limit 자동 결정에 사용)
            context_limit: 컨텍스트 윈도우 크기 (직접 지정 시)
            warn_ratio: 경고 임계값 (0.0~1.0)
            block_ratio: 차단 임계값 (0.0~1.0)
            auto_compact_strategy: 자동 컴팩션 전략
            auto_compact_keep_count: 자동 컴팩션 시 유지할 메시지 수
        """
        self._model = model
        self._context_limit = context_limit or get_context_limit(model)
        self._warn_ratio = warn_ratio
        self._block_ratio = block_ratio
        self._auto_compact_strategy = auto_compact_strategy
        self._auto_compact_keep_count = auto_compact_keep_count

        # 통계
        self._check_count = 0
        self._warn_count = 0
        self._block_count = 0
        self._compact_count = 0

    @property
    def context_limit(self) -> int:
        return self._context_limit

    @property
    def warn_threshold(self) -> int:
        return int(self._context_limit * self._warn_ratio)

    @property
    def block_threshold(self) -> int:
        return int(self._context_limit * self._block_ratio)

    @property
    def stats(self) -> Dict[str, int]:
        return {
            "checks": self._check_count,
            "warnings": self._warn_count,
            "blocks": self._block_count,
            "compactions": self._compact_count,
        }

    def check(
        self,
        messages: List[Dict[str, Any]],
        system_prompt_tokens: int = 0,
    ) -> ContextCheckResult:
        """메시지 리스트의 컨텍스트 사용량을 체크.

        Args:
            messages: 메시지 리스트 (LangChain 또는 dict 형태)
            system_prompt_tokens: 시스템 프롬프트의 추정 토큰 수

        Returns:
            ContextCheckResult
        """
        self._check_count += 1

        estimated = estimate_messages_tokens(messages) + system_prompt_tokens
        ratio = estimated / self._context_limit if self._context_limit > 0 else 1.0

        if ratio >= 1.0:
            status = ContextStatus.OVERFLOW
            message = (
                f"⛔ Context OVERFLOW: {estimated:,} tokens estimated "
                f"(limit: {self._context_limit:,}, {ratio:.1%})"
            )
            self._block_count += 1
        elif ratio >= self._block_ratio:
            status = ContextStatus.BLOCK
            message = (
                f"🔴 Context BLOCK threshold: {estimated:,} tokens estimated "
                f"(limit: {self._context_limit:,}, {ratio:.1%}). "
                f"Compaction recommended."
            )
            self._block_count += 1
        elif ratio >= self._warn_ratio:
            status = ContextStatus.WARN
            message = (
                f"🟡 Context WARN threshold: {estimated:,} tokens estimated "
                f"(limit: {self._context_limit:,}, {ratio:.1%}). "
                f"Consider reducing context."
            )
            self._warn_count += 1
        else:
            status = ContextStatus.OK
            message = ""

        if message:
            logger.info(message)

        return ContextCheckResult(
            status=status,
            estimated_tokens=estimated,
            context_limit=self._context_limit,
            usage_ratio=ratio,
            message=message,
        )

    def check_text(self, text: str) -> ContextCheckResult:
        """단일 텍스트의 컨텍스트 사용량 체크 (편의 메서드)."""
        estimated = estimate_tokens(text)
        ratio = estimated / self._context_limit if self._context_limit > 0 else 1.0

        if ratio >= self._block_ratio:
            status = ContextStatus.BLOCK
        elif ratio >= self._warn_ratio:
            status = ContextStatus.WARN
        else:
            status = ContextStatus.OK

        return ContextCheckResult(
            status=status,
            estimated_tokens=estimated,
            context_limit=self._context_limit,
            usage_ratio=ratio,
        )

    def auto_compact(
        self,
        messages: List[Dict[str, Any]],
        strategy: Optional[CompactionStrategy] = None,
        keep_count: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """자동 컴팩션 적용.

        Args:
            messages: 원본 메시지 리스트
            strategy: 컴팩션 전략 (None이면 기본값 사용)
            keep_count: 유지할 메시지 수 (None이면 기본값 사용)

        Returns:
            컴팩션된 메시지 리스트
        """
        self._compact_count += 1
        used_strategy = strategy or self._auto_compact_strategy
        used_keep_count = keep_count or self._auto_compact_keep_count

        original_tokens = estimate_messages_tokens(messages)
        compacted = compact_messages(
            messages,
            strategy=used_strategy,
            keep_count=used_keep_count,
        )
        new_tokens = estimate_messages_tokens(compacted)

        logger.info(
            f"Context compaction: {original_tokens:,} → {new_tokens:,} tokens "
            f"({len(messages)} → {len(compacted)} messages, "
            f"strategy={used_strategy.value})"
        )

        return compacted

    def check_and_compact(
        self,
        messages: List[Dict[str, Any]],
        system_prompt_tokens: int = 0,
    ) -> Tuple[List[Dict[str, Any]], ContextCheckResult]:
        """체크와 컴팩션을 한번에 수행.

        블록 수준이면 자동 컴팩션을 적용합니다.

        Args:
            messages: 메시지 리스트
            system_prompt_tokens: 시스템 프롬프트 토큰 수

        Returns:
            (컴팩션된 메시지, 체크 결과) 튜플
        """
        result = self.check(messages, system_prompt_tokens)

        if result.should_block:
            compacted = self.auto_compact(messages)
            # 재체크
            result = self.check(compacted, system_prompt_tokens)
            return compacted, result

        return messages, result
