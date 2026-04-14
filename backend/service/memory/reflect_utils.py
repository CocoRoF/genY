"""Memory reflection utilities.

Extracted from the deprecated workflow memory_reflect_node to provide
the get_memory_model() function without workflow dependencies.
"""

from __future__ import annotations

import os
from logging import getLogger

logger = getLogger(__name__)


def get_memory_model():
    """Create a lightweight ChatAnthropic model for memory reflection.

    Returns None if API key is not configured.
    """
    try:
        from service.config.manager import get_config_manager
        from service.config.sub_config.general.api_config import APIConfig

        api_cfg = get_config_manager().load_config(APIConfig)
        api_key = api_cfg.anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        mem_model = api_cfg.memory_model

        if not api_key or not mem_model:
            return None

        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=mem_model,
            api_key=api_key,
            max_tokens=2048,
            timeout=30,
        )
    except Exception as e:
        logger.debug("get_memory_model failed: %s", e)
        return None
