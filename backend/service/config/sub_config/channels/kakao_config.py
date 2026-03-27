"""
KakaoTalk Chatbot Configuration.

Enables Geny Agent integration with KakaoTalk via Kakao i OpenBuilder (Chatbot Admin Center).
Users interact with Claude sessions through KakaoTalk channel chatbot messages.

Architecture:
    KakaoTalk User → KakaoTalk Channel → Chatbot Admin Center → Skill(POST) → Geny Agent → SkillResponse

References:
    - Chatbot Admin Center: https://chatbot.kakao.com
    - Skill Development Guide: https://kakaobusiness.gitbook.io/main/tool/chatbot/skill_guide
    - Response Type JSON Format: https://kakaobusiness.gitbook.io/main/tool/chatbot/skill_guide/answer_json_format
    - Kakao Developers: https://developers.kakao.com
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List

from service.config.base import BaseConfig, ConfigField, FieldType, register_config


@register_config
@dataclass
class KakaoConfig(BaseConfig):
    """
    KakaoTalk Chatbot Configuration.

    Enables Geny Agent integration with KakaoTalk via Kakao i OpenBuilder.
    The chatbot receives user messages as Skill Payload (HTTP POST)
    and returns Claude responses as SkillResponse JSON.
    """

    # ── Connection settings ─────────────────────────────────────────────
    enabled: bool = False
    rest_api_key: str = ""          # Kakao Developers > App Keys > REST API Key
    admin_key: str = ""             # Kakao Developers > App Keys > Admin Key (server-side only)
    bot_id: str = ""                # Chatbot Admin Center Bot ID
    channel_public_id: str = ""     # KakaoTalk Channel Profile ID (e.g., _ZeUTxl)

    # ── Skill Server settings ───────────────────────────────────────────
    skill_endpoint_path: str = "/api/kakao/skill"   # Skill server endpoint path
    skill_verify_header_key: str = "X-Kakao-Skill-Token"  # Skill request verification header key
    skill_verify_token: str = ""    # Skill request verification token value (Chatbot Admin Center > Skill > Header value input)

    # ── Callback settings (AI Chatbot Callback) ──────────────────────────────────
    # Skill response timeout is 5 seconds. Use callback if Claude response exceeds 5 seconds.
    use_callback: bool = True       # Whether to use AI chatbot callback
    callback_timeout_seconds: int = 60  # Maximum wait time for callback response (seconds)

    # ── Permissions ────────────────────────────────────────────────────
    admin_user_ids: List[str] = field(default_factory=list)     # Admin botUserKey list
    allowed_user_ids: List[str] = field(default_factory=list)   # Allowed user botUserKey (empty = allow all)
    block_user_ids: List[str] = field(default_factory=list)     # Blocked user botUserKey

    # ── Response settings ──────────────────────────────────────────────
    max_message_length: int = 1000  # simpleText max character count (Kakao limit: 1000, shows "View All" beyond 500)
    response_format: str = "simpleText"  # Default response format: simpleText | textCard
    show_quick_replies: bool = True      # Show quick reply (quickReplies) buttons
    quick_reply_labels: List[str] = field(default_factory=lambda: [
        "Continue", "New Chat", "Help"
    ])

    # ── Session settings ───────────────────────────────────────────────
    session_timeout_minutes: int = 30   # Auto-close inactive sessions (minutes)
    max_sessions_per_user: int = 1      # Maximum concurrent sessions per user
    default_prompt: str = ""            # Default system prompt for KakaoTalk sessions

    @classmethod
    def get_config_name(cls) -> str:
        return "kakao"

    @classmethod
    def get_display_name(cls) -> str:
        return "KakaoTalk"

    @classmethod
    def get_description(cls) -> str:
        return (
            "Configure KakaoTalk chatbot integration via Kakao i OpenBuilder. "
            "Users interact with Claude sessions through KakaoTalk channel messages. "
            "The chatbot calls your Skill server endpoint, which processes user input "
            "and returns Claude responses as SkillResponse JSON."
        )

    @classmethod
    def get_category(cls) -> str:
        return "channels"

    @classmethod
    def get_icon(cls) -> str:
        return "kakaotalk"

    @classmethod
    def get_i18n(cls) -> Dict[str, Dict[str, Any]]:
        return {
            "ko": {
                "display_name": "KakaoTalk",
                "description": (
                    "KakaoTalk chatbot integration settings via Kakao i OpenBuilder. "
                    "Users can interact with Claude sessions through KakaoTalk channel messages."
                ),
                "groups": {
                    "connection": "Connection Settings",
                    "skill_server": "Skill Server",
                    "callback": "Callback Settings",
                    "permissions": "Permissions",
                    "response": "Response Settings",
                    "session": "Session Settings",
                },
                "fields": {
                    "enabled": {
                        "label": "Enable KakaoTalk Integration",
                        "description": "Enable or disable KakaoTalk chatbot integration",
                    },
                    "rest_api_key": {
                        "label": "REST API Key",
                        "description": (
                            "REST API key from the Kakao Developers console. "
                            "Navigate to: Kakao Developers > My Applications > App Keys > REST API Key"
                        ),
                    },
                    "admin_key": {
                        "label": "Admin Key",
                        "description": (
                            "Admin key for server-side API calls. "
                            "Navigate to: Kakao Developers > My Applications > App Keys > Admin Key. "
                            "Warning: Use only from the server side; never expose to the client."
                        ),
                    },
                    "bot_id": {
                        "label": "Chatbot Bot ID",
                        "description": (
                            "Bot ID from the Chatbot Admin Center. "
                            "Navigate to: chatbot.kakao.com > Select Bot > Settings > Bot Info"
                        ),
                    },
                    "channel_public_id": {
                        "label": "Channel Profile ID",
                        "description": (
                            "KakaoTalk channel profile ID. "
                            "Navigate to: KakaoTalk Channel Partner Center > Channel Info > Channel URL"
                        ),
                    },
                    "skill_endpoint_path": {
                        "label": "Skill Endpoint Path",
                        "description": (
                            "URL path where the Kakao chatbot sends Skill POST requests. "
                            "Register this URL in Chatbot Admin Center > Skill > Add Skill > URL"
                        ),
                    },
                    "skill_verify_header_key": {
                        "label": "Skill Verify Header Key",
                        "description": (
                            "Custom HTTP header key used to verify incoming Skill requests. "
                            "Set this in Chatbot Admin Center > Skill > Header value input"
                        ),
                    },
                    "skill_verify_token": {
                        "label": "Skill Verify Token",
                        "description": (
                            "Secret token value for the verification header. "
                            "Set this in Chatbot Admin Center > Skill > Header value input"
                        ),
                    },
                    "use_callback": {
                        "label": "Use AI Chatbot Callback",
                        "description": (
                            "Enable AI Chatbot Callback for asynchronous responses. "
                            "When the skill timeout of 5 seconds is exceeded, a 'Processing...' message is sent first "
                            "and the actual response is delivered via callback when ready."
                        ),
                    },
                    "callback_timeout_seconds": {
                        "label": "Callback Timeout (seconds)",
                        "description": "Maximum time in seconds to wait for a Claude response via callback. An error message is sent if the timeout is exceeded.",
                    },
                    "admin_user_ids": {
                        "label": "Admin User IDs (botUserKey)",
                        "description": "Comma-separated list of admin botUserKey values. Admins can use management commands such as session control.",
                    },
                    "allowed_user_ids": {
                        "label": "Allowed User IDs (Optional)",
                        "description": "Comma-separated list of allowed botUserKey values. Leave empty to allow all users.",
                    },
                    "block_user_ids": {
                        "label": "Blocked User IDs",
                        "description": "Comma-separated list of botUserKey values to block.",
                    },
                    "max_message_length": {
                        "label": "Max Message Length",
                        "description": "Maximum number of characters per message. KakaoTalk simpleText limit: 1000 characters.",
                    },
                    "response_format": {
                        "label": "Response Format",
                        "description": "Output format for chatbot responses. simpleText: text bubble, textCard: card with buttons.",
                    },
                    "show_quick_replies": {
                        "label": "Show Quick Replies",
                        "description": "Display quick reply buttons such as 'Continue', 'New Chat', and 'Help' below each response.",
                    },
                    "quick_reply_labels": {
                        "label": "Quick Reply Labels",
                        "description": "Comma-separated labels for quick reply buttons.",
                    },
                    "session_timeout_minutes": {
                        "label": "Session Timeout (minutes)",
                        "description": "Auto-close inactive sessions after the specified time",
                    },
                    "max_sessions_per_user": {
                        "label": "Max Sessions Per User",
                        "description": "Maximum number of concurrent sessions per user",
                    },
                    "default_prompt": {
                        "label": "Default System Prompt",
                        "description": "Default system prompt for sessions initiated from KakaoTalk",
                    },
                },
            }
        }

    @classmethod
    def get_fields_metadata(cls) -> List[ConfigField]:
        return [
            # ── Connection group ────────────────────────────────────────
            ConfigField(
                name="enabled",
                field_type=FieldType.BOOLEAN,
                label="Enable KakaoTalk Integration",
                description="Enable or disable KakaoTalk chatbot integration",
                default=False,
                group="connection"
            ),
            ConfigField(
                name="rest_api_key",
                field_type=FieldType.STRING,
                label="REST API Key",
                description=(
                    "REST API key from Kakao Developers console. "
                    "Navigate to: Kakao Developers > My Applications > App Keys > REST API Key"
                ),
                required=True,
                placeholder="abcdef1234567890abcdef1234567890",
                group="connection",
                secure=True
            ),
            ConfigField(
                name="admin_key",
                field_type=FieldType.STRING,
                label="Admin Key",
                description=(
                    "Admin key for server-side API calls (sending messages, managing customer files). "
                    "Navigate to: Kakao Developers > My Applications > App Keys > Admin Key. "
                    "WARNING: Must be used only from server-side, never exposed to client."
                ),
                placeholder="abcdef1234567890abcdef1234567890",
                group="connection",
                secure=True
            ),
            ConfigField(
                name="bot_id",
                field_type=FieldType.STRING,
                label="Chatbot Bot ID",
                description=(
                    "Bot ID from Chatbot Admin Center. "
                    "Navigate to: chatbot.kakao.com > Select Bot > Settings > Bot Info"
                ),
                placeholder="64xxxxxxxxxxxxxxxxxx",
                group="connection"
            ),
            ConfigField(
                name="channel_public_id",
                field_type=FieldType.STRING,
                label="Channel Public ID (Profile ID)",
                description=(
                    "KakaoTalk channel profile ID. "
                    "Navigate to: KakaoTalk Channel Partner Center > Channel Info > Channel URL. "
                    "Example: If the URL is https://pf.kakao.com/_ZeUTxl, the profile ID is _ZeUTxl"
                ),
                required=True,
                placeholder="_ZeUTxl",
                group="connection"
            ),

            # ── Skill Server group ──────────────────────────────────────
            ConfigField(
                name="skill_endpoint_path",
                field_type=FieldType.STRING,
                label="Skill Endpoint Path",
                description=(
                    "URL path where Kakao chatbot sends Skill POST requests. "
                    "Register this full URL (https://your-domain:port + path) in "
                    "Chatbot Admin Center > Skill > Add Skill > URL"
                ),
                default="/api/kakao/skill",
                placeholder="/api/kakao/skill",
                group="skill_server"
            ),
            ConfigField(
                name="skill_verify_header_key",
                field_type=FieldType.STRING,
                label="Skill Verify Header Key",
                description=(
                    "Custom HTTP header key used to verify incoming Skill requests. "
                    "Set this in Chatbot Admin Center > Skill > Header value input as the header key."
                ),
                default="X-Kakao-Skill-Token",
                placeholder="X-Kakao-Skill-Token",
                group="skill_server"
            ),
            ConfigField(
                name="skill_verify_token",
                field_type=FieldType.STRING,
                label="Skill Verify Token",
                description=(
                    "Secret token value for the verification header. "
                    "Set this in Chatbot Admin Center > Skill > Header value input as the header value. "
                    "Geny Agent will reject requests without a matching token."
                ),
                placeholder="your-secret-token-value",
                group="skill_server",
                secure=True
            ),

            # ── Callback group ──────────────────────────────────────────
            ConfigField(
                name="use_callback",
                field_type=FieldType.BOOLEAN,
                label="Use AI Chatbot Callback",
                description=(
                    "Enable AI Chatbot Callback for asynchronous responses. "
                    "Kakao skill timeout is 5 seconds. Since Claude responses often take longer, "
                    "enabling callback sends a 'processing...' message first and delivers "
                    "the actual response via callback when ready."
                ),
                default=True,
                group="callback"
            ),
            ConfigField(
                name="callback_timeout_seconds",
                field_type=FieldType.NUMBER,
                label="Callback Timeout (seconds)",
                description=(
                    "Maximum seconds to wait for Claude response via callback. "
                    "After timeout, a fallback error message is sent."
                ),
                default=60,
                min_value=5,
                max_value=120,
                group="callback"
            ),

            # ── Permissions group ───────────────────────────────────────
            ConfigField(
                name="admin_user_ids",
                field_type=FieldType.TEXTAREA,
                label="Admin User IDs (botUserKey)",
                description=(
                    "Comma-separated list of botUserKey values for admin users. "
                    "Admins can use management commands (e.g., session control, config reload). "
                    "botUserKey is found in Skill Payload: userRequest.user.properties.botUserKey"
                ),
                placeholder="abc123def456, ghi789jkl012",
                group="permissions"
            ),
            ConfigField(
                name="allowed_user_ids",
                field_type=FieldType.TEXTAREA,
                label="Allowed User IDs (Optional)",
                description=(
                    "Comma-separated list of botUserKey values allowed to use the bot. "
                    "Leave empty to allow all users."
                ),
                placeholder="abc123def456, ghi789jkl012",
                group="permissions"
            ),
            ConfigField(
                name="block_user_ids",
                field_type=FieldType.TEXTAREA,
                label="Blocked User IDs",
                description="Comma-separated list of botUserKey values to block from using the bot.",
                placeholder="abc123def456",
                group="permissions"
            ),

            # ── Response group ──────────────────────────────────────────
            ConfigField(
                name="max_message_length",
                field_type=FieldType.NUMBER,
                label="Max Message Length",
                description=(
                    "Maximum characters per message. "
                    "KakaoTalk simpleText limit is 1000 characters. "
                    "Messages over 500 characters show a 'View All' button."
                ),
                default=1000,
                min_value=100,
                max_value=1000,
                group="response"
            ),
            ConfigField(
                name="response_format",
                field_type=FieldType.SELECT,
                label="Response Format",
                description=(
                    "Output format for chatbot responses. "
                    "simpleText: Plain text bubble. "
                    "textCard: Card with optional buttons."
                ),
                default="simpleText",
                options=[
                    {"value": "simpleText", "label": "Simple Text (Text Bubble)"},
                    {"value": "textCard", "label": "Text Card (Card with Buttons)"},
                ],
                group="response"
            ),
            ConfigField(
                name="show_quick_replies",
                field_type=FieldType.BOOLEAN,
                label="Show Quick Replies",
                description=(
                    "Display quick reply (shortcut response) buttons below each response "
                    "for common actions like 'Continue', 'New Chat', 'Help'."
                ),
                default=True,
                group="response"
            ),
            ConfigField(
                name="quick_reply_labels",
                field_type=FieldType.TEXTAREA,
                label="Quick Reply Labels",
                description=(
                    "Comma-separated labels for quick reply buttons. "
                    "Each label becomes a clickable button below the response."
                ),
                placeholder="Continue, New Chat, Help",
                group="response"
            ),

            # ── Session group ───────────────────────────────────────────
            ConfigField(
                name="session_timeout_minutes",
                field_type=FieldType.NUMBER,
                label="Session Timeout (minutes)",
                description="Auto-close inactive sessions after this many minutes",
                default=30,
                min_value=5,
                max_value=1440,
                group="session"
            ),
            ConfigField(
                name="max_sessions_per_user",
                field_type=FieldType.NUMBER,
                label="Max Sessions Per User",
                description="Maximum concurrent sessions per user",
                default=1,
                min_value=1,
                max_value=5,
                group="session"
            ),
            ConfigField(
                name="default_prompt",
                field_type=FieldType.TEXTAREA,
                label="Default System Prompt",
                description="Default system prompt for KakaoTalk-initiated sessions",
                placeholder="You are a helpful assistant...",
                group="session"
            ),
        ]
