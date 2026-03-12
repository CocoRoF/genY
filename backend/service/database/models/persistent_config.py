"""
Persistent Config Model — Database model for storing configuration

All GenY settings (api, github, language, limits, ...)
are managed as records in this table.
"""
from typing import Dict, Any
from service.database.models.base_model import BaseModel


class PersistentConfigModel(BaseModel):
    """Model for storing configuration data."""

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

    @classmethod
    def get_create_table_query(cls, db_type: str = "postgresql") -> str:
        """Generate CREATE TABLE query — includes UNIQUE constraint."""
        base_query = super().get_create_table_query(db_type)
        # Add UNIQUE constraint (required for ON CONFLICT UPSERT)
        # Insert UNIQUE constraint before the closing parenthesis
        constraint = ",\n            UNIQUE (config_name, config_key)"
        # Insert before last ')'
        idx = base_query.rfind(')')
        if idx != -1:
            return base_query[:idx] + constraint + base_query[idx:]
        return base_query

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
