"""
Base Data Model Class

Parent class for all database models.
Define get_table_name() and get_schema() to
automatically generate CREATE TABLE / INSERT / UPDATE queries,
and auto migration (ALTER TABLE ADD COLUMN) on schema changes.
"""
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, Any, Optional, List
import json
import logging
import os
from zoneinfo import ZoneInfo

logger = logging.getLogger("database-base-model")

# Get timezone from environment variable
TIMEZONE = ZoneInfo(os.getenv('TIMEZONE', 'Asia/Seoul'))


class BaseModel(ABC):
    """Base class for all data models."""

    def __init__(self, **kwargs):
        self.id: Optional[int] = kwargs.get('id')
        self.created_at: Optional[datetime] = kwargs.get('created_at')
        self.updated_at: Optional[datetime] = kwargs.get('updated_at')

        # Set additional fields dynamically
        for key, value in kwargs.items():
            if not hasattr(self, key):
                setattr(self, key, value)

    @abstractmethod
    def get_table_name(self) -> str:
        """Return the table name."""
        pass

    @abstractmethod
    def get_schema(self) -> Dict[str, str]:
        """
        Return the table schema (column_name: type).

        Example:
            {
                'name': 'VARCHAR(255) NOT NULL',
                'config_value': 'TEXT',
                'data_type': "VARCHAR(50) DEFAULT 'string'",
            }
        """
        pass

    def get_indexes(self) -> List[tuple]:
        """
        Define table indexes. Override in subclass.

        Returns:
            [("index_name", "column1, column2 DESC"), ...]
        """
        return []

    @classmethod
    def now(cls) -> datetime:
        """Return current time in the configured timezone."""
        return datetime.now(TIMEZONE)

    def to_dict(self) -> Dict[str, Any]:
        """Convert object to dictionary."""
        result = {}
        for key, value in self.__dict__.items():
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, (list, dict)):
                result[key] = json.dumps(value) if value else None
            else:
                result[key] = value
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        """Create object from dictionary."""
        tz = TIMEZONE

        for field in ("created_at", "updated_at"):
            if field in data and isinstance(data[field], str):
                dt = datetime.fromisoformat(data[field])
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=tz)
                else:
                    dt = dt.astimezone(tz)
                data[field] = dt

        return cls(**data)

    def get_insert_query(self, db_type: str = "postgresql") -> tuple:
        """Generate INSERT query."""
        data = self.to_dict()
        # Exclude id and timestamps (auto-generated)
        data.pop('id', None)
        data.pop('created_at', None)
        data.pop('updated_at', None)

        columns = list(data.keys())
        values = list(data.values())

        if db_type == "postgresql":
            placeholders = ["%s" for _ in range(len(values))]
        else:
            placeholders = ["?" for _ in range(len(values))]

        query = f"""INSERT INTO {self.get_table_name()} ({', '.join(columns)})
        VALUES ({', '.join(placeholders)})"""

        return query.strip(), values

    def get_update_query(self, db_type: str = "postgresql") -> tuple:
        """Generate UPDATE query."""
        if not self.id:
            raise ValueError("Cannot update record without ID")

        data = self.to_dict()
        data.pop('id', None)
        data.pop('created_at', None)
        data['updated_at'] = self.now().isoformat()

        columns = list(data.keys())
        values = list(data.values())

        if db_type == "postgresql":
            set_clauses = [f"{col} = %s" for col in columns]
            where_placeholder = "%s"
        else:
            set_clauses = [f"{col} = ?" for col in columns]
            where_placeholder = "?"

        query = f"""UPDATE {self.get_table_name()}
        SET {', '.join(set_clauses)}
        WHERE id = {where_placeholder}"""

        values.append(self.id)
        return query.strip(), values

    @classmethod
    def get_create_table_query(cls, db_type: str = "postgresql") -> str:
        """Generate CREATE TABLE query."""
        instance = cls()
        schema = instance.get_schema()

        if db_type == "postgresql":
            base_columns = {
                'id': 'SERIAL PRIMARY KEY',
                'created_at': f"TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE '{TIMEZONE.key}')",
                'updated_at': f"TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE '{TIMEZONE.key}')"
            }
        else:
            base_columns = {
                'id': 'INTEGER PRIMARY KEY AUTOINCREMENT',
                'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            }

        all_columns = {**base_columns, **schema}

        columns_def = []
        for col_name, col_type in all_columns.items():
            columns_def.append(f"{col_name} {col_type}")

        columns_str = ',\n            '.join(columns_def)
        query = f"""CREATE TABLE IF NOT EXISTS {instance.get_table_name()} (
            {columns_str}
        )"""

        return query.strip()
