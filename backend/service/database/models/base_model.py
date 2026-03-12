"""
기본 데이터 모델 클래스

모든 데이터베이스 모델의 부모 클래스.
get_table_name()과 get_schema()를 정의하면
자동으로 CREATE TABLE / INSERT / UPDATE 쿼리가 생성되며,
스키마 변경 시 자동 마이그레이션(ALTER TABLE ADD COLUMN)이 수행됩니다.
"""
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, Any, Optional, List
import json
import logging
import os
from zoneinfo import ZoneInfo

logger = logging.getLogger("database-base-model")

# 환경변수에서 타임존 가져오기
TIMEZONE = ZoneInfo(os.getenv('TIMEZONE', 'Asia/Seoul'))


class BaseModel(ABC):
    """모든 데이터 모델의 기본 클래스"""

    def __init__(self, **kwargs):
        self.id: Optional[int] = kwargs.get('id')
        self.created_at: Optional[datetime] = kwargs.get('created_at')
        self.updated_at: Optional[datetime] = kwargs.get('updated_at')

        # 추가 필드들을 동적으로 설정
        for key, value in kwargs.items():
            if not hasattr(self, key):
                setattr(self, key, value)

    @abstractmethod
    def get_table_name(self) -> str:
        """테이블 이름 반환"""
        pass

    @abstractmethod
    def get_schema(self) -> Dict[str, str]:
        """
        테이블 스키마 반환 (컬럼명: 타입)

        예시:
            {
                'name': 'VARCHAR(255) NOT NULL',
                'config_value': 'TEXT',
                'data_type': "VARCHAR(50) DEFAULT 'string'",
            }
        """
        pass

    def get_indexes(self) -> List[tuple]:
        """
        테이블 인덱스 정의. 서브클래스에서 오버라이드하여 사용.

        Returns:
            [("인덱스명", "컬럼1, 컬럼2 DESC"), ...]
        """
        return []

    @classmethod
    def now(cls) -> datetime:
        """현재 시간을 설정된 타임존으로 반환"""
        return datetime.now(TIMEZONE)

    def to_dict(self) -> Dict[str, Any]:
        """객체를 딕셔너리로 변환"""
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
        """딕셔너리에서 객체 생성"""
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
        """INSERT 쿼리 생성"""
        data = self.to_dict()
        # id와 타임스탬프 제외 (자동 생성)
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
        """UPDATE 쿼리 생성"""
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
        """CREATE TABLE 쿼리 생성"""
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
