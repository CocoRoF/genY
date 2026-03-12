"""
Persistent Config 모델 — 설정 저장을 위한 데이터베이스 모델

모든 GenY 설정(api, github, language, limits, ...)이
이 테이블의 레코드로 관리됩니다.
"""
from typing import Dict, Any
from service.database.models.base_model import BaseModel


class PersistentConfigModel(BaseModel):
    """설정 데이터를 저장하기 위한 모델"""

    def __init__(self, config_name: str = "", config_key: str = "",
                 config_value: str = "", data_type: str = "string",
                 category: str = "", **kwargs):
        super().__init__(**kwargs)
        self.config_name = config_name      # e.g. "api", "github", "limits"
        self.config_key = config_key        # e.g. "anthropic_api_key"
        self.config_value = config_value    # serialized value
        self.data_type = data_type          # string, int, float, bool, list, dict
        self.category = category            # e.g. "general", "channels"

    def get_table_name(self) -> str:
        return "persistent_configs"

    def get_schema(self) -> Dict[str, str]:
        return {
            'config_name': 'VARCHAR(255) NOT NULL',
            'config_key': 'VARCHAR(255) NOT NULL',
            'config_value': 'TEXT',
            'data_type': "VARCHAR(50) DEFAULT 'string'",
            'category': 'VARCHAR(100)',
        }

    def get_indexes(self) -> list:
        return [
            ("idx_persistent_configs_name_key", "config_name, config_key"),
            ("idx_persistent_configs_category", "category"),
        ]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PersistentConfigModel':
        return cls(
            config_name=data.get('config_name', ''),
            config_key=data.get('config_key', ''),
            config_value=data.get('config_value', ''),
            data_type=data.get('data_type', 'string'),
            category=data.get('category', ''),
            **{k: v for k, v in data.items()
               if k not in ('config_name', 'config_key', 'config_value', 'data_type', 'category')}
        )

    def __repr__(self):
        return (f"PersistentConfigModel(id={self.id}, config_name='{self.config_name}', "
                f"config_key='{self.config_key}', data_type='{self.data_type}')")
