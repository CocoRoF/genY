"""
모델 모듈 초기화

모든 모델 클래스를 등록하고 APPLICATION_MODELS 리스트를 제공합니다.
새 모델을 추가할 때는:
1. models/ 에 새 파일을 생성
2. 여기에 import + APPLICATION_MODELS에 추가
→ 자동으로 테이블 생성 및 마이그레이션 대상이 됩니다.
"""
from service.database.models.base_model import BaseModel
from service.database.models.persistent_config import PersistentConfigModel

__all__ = [
    'BaseModel',
    'PersistentConfigModel',
]

# 애플리케이션에서 사용할 모델 목록
# 여기에 등록된 모든 모델은 앱 시작 시 자동으로 테이블이 생성되고
# 스키마 변경이 감지되면 ALTER TABLE로 마이그레이션됩니다.
APPLICATION_MODELS = [
    PersistentConfigModel,
]
