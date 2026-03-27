"""
Discord Bot Configuration.

Enables Geny Agent integration with Discord servers.
Allows users to interact with Claude sessions via Discord messages.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List

from service.config.base import BaseConfig, ConfigField, FieldType, register_config


@register_config
@dataclass
class DiscordConfig(BaseConfig):
    """
    Discord Bot Configuration.

    Enables Geny Agent integration with Discord servers.
    Allows users to interact with Claude sessions via Discord messages.
    """

    # Connection settings
    enabled: bool = False
    bot_token: str = ""
    application_id: str = ""

    # Server/Guild settings
    guild_ids: List[str] = field(default_factory=list)  # Specific guilds, empty = all

    # Channel settings
    allowed_channel_ids: List[str] = field(default_factory=list)  # Empty = all channels
    command_prefix: str = "!"

    # Permissions
    admin_role_ids: List[str] = field(default_factory=list)
    allowed_user_ids: List[str] = field(default_factory=list)  # Empty = all users

    # Behavior settings
    respond_to_mentions: bool = True
    respond_to_dms: bool = False
    auto_thread: bool = True  # Create threads for conversations
    max_message_length: int = 2000

    # Session settings
    session_timeout_minutes: int = 30  # Auto-close inactive sessions
    max_sessions_per_user: int = 3
    default_prompt: str = ""  # Default system prompt for Discord sessions

    @classmethod
    def get_config_name(cls) -> str:
        return "discord"

    @classmethod
    def get_display_name(cls) -> str:
        return "Discord"

    @classmethod
    def get_description(cls) -> str:
        return "Configure Discord bot integration for Geny Agent. Allows users to interact with Claude sessions through Discord messages."

    @classmethod
    def get_category(cls) -> str:
        return "channels"

    @classmethod
    def get_icon(cls) -> str:
        return "discord"

    @classmethod
    def get_i18n(cls) -> Dict[str, Dict[str, Any]]:
        return {
            "ko": {
                "display_name": "Discord",
                "description": "Discord bot integration settings. Users can interact with Claude sessions through Discord messages.",
                "groups": {
                    "connection": "Connection Settings",
                    "server": "Server Settings",
                    "permissions": "Permissions",
                    "behavior": "Behavior Settings",
                    "session": "Session Settings",
                },
                "fields": {
                    "enabled": {
                        "label": "Enable Discord Integration",
                        "description": "Enable or disable Discord bot integration",
                    },
                    "bot_token": {
                        "label": "Bot Token",
                        "description": "Discord bot token from the Discord Developer Portal",
                    },
                    "application_id": {
                        "label": "Application ID",
                        "description": "Discord application ID from the Developer Portal",
                    },
                    "guild_ids": {
                        "label": "Guild IDs (Optional)",
                        "description": "Comma-separated list of guild/server IDs. Leave empty to allow all guilds.",
                    },
                    "allowed_channel_ids": {
                        "label": "Allowed Channel IDs (Optional)",
                        "description": "Comma-separated list of channel IDs the bot responds to. Leave empty to allow all channels.",
                    },
                    "command_prefix": {
                        "label": "Command Prefix",
                        "description": "Prefix for bot commands (e.g., !claude, /ask)",
                    },
                    "admin_role_ids": {
                        "label": "Admin Role IDs",
                        "description": "Comma-separated list of role IDs with admin privileges",
                    },
                    "allowed_user_ids": {
                        "label": "Allowed User IDs (Optional)",
                        "description": "Comma-separated list of user IDs allowed to use the bot. Leave empty to allow all users.",
                    },
                    "respond_to_mentions": {
                        "label": "Respond to Mentions",
                        "description": "Respond when the bot is mentioned in a message",
                    },
                    "respond_to_dms": {
                        "label": "Respond to DMs",
                        "description": "Allow users to interact via direct messages",
                    },
                    "auto_thread": {
                        "label": "Auto Create Threads",
                        "description": "Automatically create threads for conversations",
                    },
                    "max_message_length": {
                        "label": "Max Message Length",
                        "description": "Maximum number of characters per message (Discord limit: 2000)",
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
                        "description": "Default system prompt for sessions initiated from Discord",
                    },
                },
            }
        }

    @classmethod
    def get_fields_metadata(cls) -> List[ConfigField]:
        return [
            # Connection group
            ConfigField(
                name="enabled",
                field_type=FieldType.BOOLEAN,
                label="Enable Discord Integration",
                description="Enable or disable Discord bot integration",
                default=False,
                group="connection"
            ),
            ConfigField(
                name="bot_token",
                field_type=FieldType.PASSWORD,
                label="Bot Token",
                description="Discord bot token from Discord Developer Portal",
                required=True,
                placeholder="Enter your Discord bot token",
                group="connection",
                secure=True
            ),
            ConfigField(
                name="application_id",
                field_type=FieldType.STRING,
                label="Application ID",
                description="Discord application ID from Developer Portal",
                placeholder="123456789012345678",
                group="connection"
            ),

            # Server group
            ConfigField(
                name="guild_ids",
                field_type=FieldType.TEXTAREA,
                label="Guild IDs (Optional)",
                description="Comma-separated list of guild/server IDs. Leave empty for all guilds.",
                placeholder="123456789012345678, 987654321098765432",
                group="server"
            ),
            ConfigField(
                name="allowed_channel_ids",
                field_type=FieldType.TEXTAREA,
                label="Allowed Channel IDs (Optional)",
                description="Comma-separated list of channel IDs where bot responds. Leave empty for all channels.",
                placeholder="123456789012345678, 987654321098765432",
                group="server"
            ),
            ConfigField(
                name="command_prefix",
                field_type=FieldType.STRING,
                label="Command Prefix",
                description="Prefix for bot commands (e.g., !claude, /ask)",
                default="!",
                placeholder="!",
                group="server"
            ),

            # Permissions group
            ConfigField(
                name="admin_role_ids",
                field_type=FieldType.TEXTAREA,
                label="Admin Role IDs",
                description="Comma-separated list of role IDs with admin privileges",
                placeholder="123456789012345678",
                group="permissions"
            ),
            ConfigField(
                name="allowed_user_ids",
                field_type=FieldType.TEXTAREA,
                label="Allowed User IDs (Optional)",
                description="Comma-separated list of user IDs allowed to use the bot. Leave empty for all users.",
                placeholder="123456789012345678, 987654321098765432",
                group="permissions"
            ),

            # Behavior group
            ConfigField(
                name="respond_to_mentions",
                field_type=FieldType.BOOLEAN,
                label="Respond to Mentions",
                description="Respond when the bot is mentioned in a message",
                default=True,
                group="behavior"
            ),
            ConfigField(
                name="respond_to_dms",
                field_type=FieldType.BOOLEAN,
                label="Respond to Direct Messages",
                description="Allow users to interact via DMs",
                default=False,
                group="behavior"
            ),
            ConfigField(
                name="auto_thread",
                field_type=FieldType.BOOLEAN,
                label="Auto Create Threads",
                description="Automatically create threads for conversations",
                default=True,
                group="behavior"
            ),
            ConfigField(
                name="max_message_length",
                field_type=FieldType.NUMBER,
                label="Max Message Length",
                description="Maximum characters per message (Discord limit: 2000)",
                default=2000,
                min_value=100,
                max_value=2000,
                group="behavior"
            ),

            # Session group
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
                default=3,
                min_value=1,
                max_value=10,
                group="session"
            ),
            ConfigField(
                name="default_prompt",
                field_type=FieldType.TEXTAREA,
                label="Default System Prompt",
                description="Default system prompt for Discord-initiated sessions",
                placeholder="You are a helpful assistant...",
                group="session"
            ),
        ]
