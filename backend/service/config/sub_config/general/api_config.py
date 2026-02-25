"""
Claude API Configuration.

Controls the Anthropic API key, default model, thinking budget,
and autonomous permission mode.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from service.config.base import BaseConfig, ConfigField, FieldType, register_config
from service.config.sub_config.general.env_utils import env_sync, read_env_defaults

MODEL_OPTIONS = [
    {"value": "claude-sonnet-4-5-20250929", "label": "Claude Sonnet 4.5"},
    {"value": "claude-opus-4-20250514", "label": "Claude Opus 4"},
    {"value": "claude-sonnet-4-20250514", "label": "Claude Sonnet 4"},
    {"value": "claude-haiku-4-20250414", "label": "Claude Haiku 4"},
]


@register_config
@dataclass
class APIConfig(BaseConfig):
    """Anthropic API and model settings."""

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-5-20250929"
    max_thinking_tokens: int = 31999
    skip_permissions: bool = True

    _ENV_MAP = {
        "anthropic_api_key": "ANTHROPIC_API_KEY",
        "anthropic_model": "ANTHROPIC_MODEL",
        "max_thinking_tokens": "MAX_THINKING_TOKENS",
        "skip_permissions": "CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS",
    }

    @classmethod
    def get_default_instance(cls) -> "APIConfig":
        defaults = read_env_defaults(cls._ENV_MAP, cls.__dataclass_fields__)
        return cls(**defaults)

    @classmethod
    def get_config_name(cls) -> str:
        return "api"

    @classmethod
    def get_display_name(cls) -> str:
        return "Claude API"

    @classmethod
    def get_description(cls) -> str:
        return "Anthropic API key, default model, thinking budget, and permission mode."

    @classmethod
    def get_category(cls) -> str:
        return "general"

    @classmethod
    def get_icon(cls) -> str:
        return "api"

    @classmethod
    def get_fields_metadata(cls) -> List[ConfigField]:
        return [
            ConfigField(
                name="anthropic_api_key",
                field_type=FieldType.PASSWORD,
                label="Anthropic API Key",
                description="API key for Anthropic Claude models",
                required=True,
                placeholder="sk-ant-…",
                group="api",
                secure=True,
                apply_change=env_sync("ANTHROPIC_API_KEY"),
            ),
            ConfigField(
                name="anthropic_model",
                field_type=FieldType.SELECT,
                label="Default Model",
                description="Default Claude model for new sessions",
                default="claude-sonnet-4-5-20250929",
                options=MODEL_OPTIONS,
                group="api",
                apply_change=env_sync("ANTHROPIC_MODEL"),
            ),
            ConfigField(
                name="max_thinking_tokens",
                field_type=FieldType.NUMBER,
                label="Max Thinking Tokens",
                description="Extended Thinking budget (0 to disable)",
                default=31999,
                min_value=0,
                max_value=128000,
                group="api",
                apply_change=env_sync("MAX_THINKING_TOKENS"),
            ),
            ConfigField(
                name="skip_permissions",
                field_type=FieldType.BOOLEAN,
                label="Skip Permission Prompts",
                description="⚠️ Autonomous mode — skip all confirmation dialogs",
                default=True,
                group="permissions",
                apply_change=env_sync("CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS"),
            ),
        ]
