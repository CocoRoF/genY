"""
Shared Folder Configuration.

Controls the shared folder path and whether the shared folder feature
is enabled. When enabled, every session gets a symlink (_shared) to the
common shared folder, allowing all sessions to exchange files.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, List

from service.config.base import BaseConfig, ConfigField, FieldType, register_config
from service.config.sub_config.general.env_utils import env_sync, read_env_defaults


def _apply_shared_folder_change(_old: Any, new_val: Any) -> None:
    """Apply shared folder path change at runtime."""
    import os
    from logging import getLogger

    logger = getLogger(__name__)
    str_val = str(new_val) if new_val else ""
    os.environ["GENY_SHARED_FOLDER_PATH"] = str_val
    logger.info(f"Shared folder path updated in env: {str_val}")

    # Update the running SharedFolderManager if it exists
    try:
        from service.shared_folder import get_shared_folder_manager
        if str_val:
            mgr = get_shared_folder_manager()
            mgr.update_path(str_val)
    except Exception as e:
        logger.warning(f"Failed to update SharedFolderManager: {e}")


def _apply_enabled_change(_old: Any, new_val: Any) -> None:
    """Apply enabled/disabled change at runtime."""
    import os
    from logging import getLogger

    logger = getLogger(__name__)
    os.environ["GENY_SHARED_FOLDER_ENABLED"] = "true" if new_val else "false"
    logger.info(f"Shared folder enabled: {new_val}")


@register_config
@dataclass
class SharedFolderConfig(BaseConfig):
    """Shared folder settings for cross-session collaboration."""

    enabled: bool = True
    shared_folder_path: str = ""
    link_name: str = "_shared"

    _ENV_MAP = {
        "enabled": "GENY_SHARED_FOLDER_ENABLED",
        "shared_folder_path": "GENY_SHARED_FOLDER_PATH",
        "link_name": "GENY_SHARED_FOLDER_LINK_NAME",
    }

    @classmethod
    def get_default_instance(cls) -> "SharedFolderConfig":
        defaults = read_env_defaults(cls._ENV_MAP, cls.__dataclass_fields__)
        return cls(**defaults)

    @classmethod
    def get_config_name(cls) -> str:
        return "shared_folder"

    @classmethod
    def get_display_name(cls) -> str:
        return "Shared Folder"

    @classmethod
    def get_description(cls) -> str:
        return "Shared folder accessible by all sessions for cross-session file exchange and collaboration."

    @classmethod
    def get_category(cls) -> str:
        return "general"

    @classmethod
    def get_icon(cls) -> str:
        return "folder"

    @classmethod
    def get_i18n(cls) -> Dict[str, Dict[str, Any]]:
        return {
            "ko": {
                "display_name": "Shared Folder",
                "description": "Shared folder accessible by all sessions — settings for cross-session file exchange and collaboration.",
                "groups": {
                    "shared_folder": "Shared Folder Settings",
                },
                "fields": {
                    "enabled": {
                        "label": "Enable Shared Folder",
                        "description": "When enabled, a shared folder link is automatically created in every session",
                    },
                    "shared_folder_path": {
                        "label": "Shared Folder Path",
                        "description": "Absolute path for the shared folder (uses default path if empty)",
                        "placeholder": "If empty, default: {STORAGE_ROOT}/_shared",
                    },
                    "link_name": {
                        "label": "Link Name",
                        "description": "Name of the shared folder link created inside each session's folder",
                        "placeholder": "_shared",
                    },
                },
            }
        }

    @classmethod
    def get_fields_metadata(cls) -> List[ConfigField]:
        return [
            ConfigField(
                name="enabled",
                field_type=FieldType.BOOLEAN,
                label="Enable Shared Folder",
                description="When enabled, a symlink to the shared folder is created in every session's storage directory",
                default=True,
                group="shared_folder",
                apply_change=_apply_enabled_change,
            ),
            ConfigField(
                name="shared_folder_path",
                field_type=FieldType.STRING,
                label="Shared Folder Path",
                description="Absolute path for the shared folder. Leave empty to use default ({STORAGE_ROOT}/_shared)",
                placeholder="Leave empty for default",
                group="shared_folder",
                apply_change=_apply_shared_folder_change,
            ),
            ConfigField(
                name="link_name",
                field_type=FieldType.STRING,
                label="Link Name",
                description="Name of the symlink created inside each session's folder",
                default="_shared",
                placeholder="_shared",
                group="shared_folder",
            ),
        ]
