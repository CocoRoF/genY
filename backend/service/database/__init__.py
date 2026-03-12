"""
데이터베이스 모듈 초기화

psycopg3 기반 ConnectionPool을 사용하여 다음 기능을 제공:
- 커넥션 풀 관리 (min_size, max_size)
- 자동 idle 커넥션 정리 (max_idle)
- 커넥션 수명 관리 (max_lifetime)
- 죽은 커넥션 자동 감지 및 폐기 (check callback)
- 자동 재연결 (reconnect_timeout)
- 연결 끊김 시 자동 복구 (retry with backoff)
- 모델 기반 자동 테이블 생성 및 스키마 마이그레이션
"""
from service.database.app_database_manager import AppDatabaseManager
from service.database.database_config import database_config, get_database_config
from service.database.models import APPLICATION_MODELS

__all__ = ['AppDatabaseManager', 'database_config', 'get_database_config', 'APPLICATION_MODELS']
