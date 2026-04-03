"""
GPT-SoVITS Configuration.

Settings for the open-source GPT-SoVITS voice cloning engine.
Supports emotion-based reference audio selection for natural expression.
Requires a locally running GPT-SoVITS Docker container.
"""

from dataclasses import dataclass
from typing import Any, Dict, List

from service.config.base import BaseConfig, ConfigField, FieldType, register_config


@register_config
@dataclass
class GPTSoVITSConfig(BaseConfig):
    """GPT-SoVITS TTS settings — open-source voice cloning"""

    enabled: bool = False
    api_url: str = "http://gpt-sovits:9880"
    voice_profile: str = "paimon_ko"
    ref_audio_dir: str = "/app/static/voices/paimon_ko"
    container_ref_dir: str = "/workspace/GPT-SoVITS/references/paimon_ko"
    prompt_text: str = "으음~ 나쁘지 않은데? 너도 먹어봐~ 우리 같이 먹자!"
    prompt_lang: str = "ko"
    top_k: int = 5
    top_p: float = 1.0
    temperature: float = 1.0
    speed: float = 1.0

    @classmethod
    def get_config_name(cls) -> str:
        return "tts_gpt_sovits"

    @classmethod
    def get_display_name(cls) -> str:
        return "GPT-SoVITS"

    @classmethod
    def get_description(cls) -> str:
        return "Open-source voice cloning — natural emotion via per-emotion reference audio"

    @classmethod
    def get_category(cls) -> str:
        return "tts"

    @classmethod
    def get_icon(cls) -> str:
        return "lab"

    @classmethod
    def get_fields_metadata(cls) -> List[ConfigField]:
        # Dynamically build profile options from voices directory
        profile_options = cls._get_profile_options()

        return [
            ConfigField(
                name="enabled",
                field_type=FieldType.BOOLEAN,
                label="Enabled",
                description="GPT-SoVITS Docker service must be running",
                group="server",
            ),
            ConfigField(
                name="api_url",
                field_type=FieldType.URL,
                label="API URL",
                description="GPT-SoVITS API v2 server address (Docker: http://gpt-sovits:9880)",
                group="server",
                placeholder="http://gpt-sovits:9880",
            ),
            ConfigField(
                name="voice_profile",
                field_type=FieldType.SELECT,
                label="Voice Profile",
                description="Select a registered voice profile — manage profiles at /tts-voice",
                group="voice",
                options=profile_options,
            ),
            ConfigField(
                name="top_k",
                field_type=FieldType.NUMBER,
                label="Top-K",
                group="generation",
                min_value=1,
                max_value=50,
            ),
            ConfigField(
                name="top_p",
                field_type=FieldType.NUMBER,
                label="Top-P",
                group="generation",
                min_value=0.0,
                max_value=1.0,
            ),
            ConfigField(
                name="temperature",
                field_type=FieldType.NUMBER,
                label="Temperature",
                group="generation",
                min_value=0.1,
                max_value=2.0,
            ),
            ConfigField(
                name="speed",
                field_type=FieldType.NUMBER,
                label="Speech Speed",
                group="generation",
                min_value=0.5,
                max_value=2.0,
            ),
        ]

    @classmethod
    def _get_profile_options(cls) -> List[Dict[str, str]]:
        """Dynamically list voice profiles for the SELECT dropdown."""
        import json as _json
        from pathlib import Path as _Path

        voices_dir = _Path(__file__).parent.parent.parent.parent.parent / "static" / "voices"
        options = []
        if voices_dir.exists():
            for d in sorted(voices_dir.iterdir()):
                if not d.is_dir():
                    continue
                label = d.name
                pj = d / "profile.json"
                if pj.exists():
                    try:
                        data = _json.loads(pj.read_text(encoding="utf-8"))
                        if data.get("display_name"):
                            label = f"{data['display_name']} ({d.name})"
                    except Exception:
                        pass
                options.append({"value": d.name, "label": label})
        return options or [{"value": "", "label": "(no profiles)"}]

    @classmethod
    def get_i18n(cls) -> Dict[str, Dict[str, Any]]:
        return {
            "ko": {
                "display_name": "GPT-SoVITS",
                "description": "오픈소스 음성 복제 — 감정별 레퍼런스 오디오로 자연스러운 감정 표현",
                "groups": {
                    "server": "서버",
                    "voice": "보이스",
                    "generation": "생성 파라미터",
                },
                "fields": {
                    "enabled": {
                        "label": "활성화",
                        "description": "GPT-SoVITS Docker 서비스가 실행 중이어야 합니다",
                    },
                    "api_url": {
                        "label": "API URL",
                        "description": "GPT-SoVITS API v2 서버 주소",
                    },
                    "voice_profile": {
                        "label": "보이스 프로필",
                        "description": "등록된 보이스 프로필 선택 — /tts-voice 페이지에서 관리",
                    },
                    "speed": {
                        "label": "발화 속도",
                    },
                },
            },
            "en": {
                "display_name": "GPT-SoVITS",
                "description": "Open-source voice cloning — emotion references",
                "groups": {
                    "server": "Server",
                    "voice": "Voice",
                    "generation": "Generation Parameters",
                },
            },
        }
