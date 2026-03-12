"""
Database Configuration Module

환경변수 기반의 PostgreSQL 데이터베이스 설정을 관리합니다.

Usage:
    from service.database.database_config import database_config

    host = database_config.POSTGRES_HOST.value
    conn_string = database_config.get_connection_string()
"""

import os
from typing import Any


class ConfigValue:
    """설정 값을 .value 속성으로 접근할 수 있게 하는 래퍼 클래스"""

    def __init__(self, value: Any):
        self._value = value

    @property
    def value(self) -> Any:
        return self._value

    def __repr__(self) -> str:
        return f"ConfigValue({self._value!r})"

    def __str__(self) -> str:
        return str(self._value)


class DatabaseConfig:
    """
    PostgreSQL 데이터베이스 설정 클래스

    Environment Variables:
        - POSTGRES_HOST: PostgreSQL 호스트 (기본값: localhost)
        - POSTGRES_PORT: PostgreSQL 포트 (기본값: 5432)
        - POSTGRES_DB: 데이터베이스 이름 (기본값: geny)
        - POSTGRES_USER: 데이터베이스 사용자 (기본값: geny)
        - POSTGRES_PASSWORD: 데이터베이스 비밀번호 (기본값: geny123)
        - AUTO_MIGRATION: 자동 마이그레이션 여부 (기본값: true)
    """

    def __init__(self):
        self._load_config()

    def _load_config(self) -> None:
        """환경변수에서 설정을 로드합니다."""
        self.POSTGRES_HOST = ConfigValue(os.getenv("POSTGRES_HOST", "localhost"))
        self.POSTGRES_PORT = ConfigValue(os.getenv("POSTGRES_PORT", "5432"))
        self.POSTGRES_DB = ConfigValue(os.getenv("POSTGRES_DB", "geny"))
        self.POSTGRES_USER = ConfigValue(os.getenv("POSTGRES_USER", "geny"))
        self.POSTGRES_PASSWORD = ConfigValue(os.getenv("POSTGRES_PASSWORD", "geny123"))
        self.DATABASE_TYPE = ConfigValue("postgresql")
        self.AUTO_MIGRATION = ConfigValue(
            os.getenv("AUTO_MIGRATION", "true").lower() in ('true', '1', 'yes', 'on')
        )

    def reload(self) -> None:
        """환경변수에서 설정을 다시 로드합니다."""
        self._load_config()

    def get_connection_string(self) -> str:
        """PostgreSQL 연결 문자열을 반환합니다."""
        return (
            f"postgresql://{self.POSTGRES_USER.value}:{self.POSTGRES_PASSWORD.value}"
            f"@{self.POSTGRES_HOST.value}:{self.POSTGRES_PORT.value}/{self.POSTGRES_DB.value}"
        )

    def get_connection_dict(self) -> dict:
        """PostgreSQL 연결 정보를 딕셔너리로 반환합니다."""
        return {
            "host": self.POSTGRES_HOST.value,
            "port": self.POSTGRES_PORT.value,
            "database": self.POSTGRES_DB.value,
            "user": self.POSTGRES_USER.value,
            "password": self.POSTGRES_PASSWORD.value,
        }

    def __repr__(self) -> str:
        return (
            f"DatabaseConfig("
            f"host={self.POSTGRES_HOST.value}, "
            f"port={self.POSTGRES_PORT.value}, "
            f"db={self.POSTGRES_DB.value}, "
            f"user={self.POSTGRES_USER.value}, "
            f"auto_migration={self.AUTO_MIGRATION.value})"
        )


# 싱글톤 인스턴스
database_config = DatabaseConfig()


def get_database_config() -> DatabaseConfig:
    """데이터베이스 설정 인스턴스를 반환합니다."""
    return database_config


def reload_database_config() -> DatabaseConfig:
    """환경변수에서 설정을 다시 로드하고 인스턴스를 반환합니다."""
    database_config.reload()
    return database_config
