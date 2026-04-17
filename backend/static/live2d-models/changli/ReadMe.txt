=== Changli (长离) — Live2D Model ===

Character      : Changli (长离 / 장리)
Origin IP      : 『鳴潮』 (Wuthering Waves / Mingchao) — © KURO GAMES / Kuro Game
Source         : 외부 무료 배포본 ("长离带水印" = "Changli with watermark" 버전)
Creator        : 미확인 (원본 배포본에 크레딧 없음)
License        : 확인 중 — 팬 제작 파생물. 원작 저작권은 쿠로게임즈에 귀속.

=== ⚠️ 워터마크 경고 ===

원본 폴더명 "带水印"은 **"워터마크 포함"** 을 의미합니다. 일반적으로 이런 배포본은:

- 텍스처·표정에 제작자 로고/서명이 박혀 있음
- 무료 이용은 허용되지만, 워터마크 제거 또는 워터마크 없는 버전은 **유료 구매가 원칙**
- 상업 이용 시 원작자(쿠로게임즈) + 모델 제작자 양쪽 허가 필요

Geny에서 이 모델을 공식 아바타로 사용하려면:
1. 배포 원본 사이트·제작자 확인
2. 상업/비상업 이용 조건 문서화
3. 워터마크가 미관상 문제가 된다면 **유료 버전 구매**

=== Asset notes ===

- 원본 파일명은 모두 한자 → Geny 컨벤션에 맞춰 다음 매핑으로 리네이밍:

    生气.exp3.json       → expressions/angry.exp3.json
    白眼.exp3.json       → expressions/eye_roll.exp3.json
    黑脸.exp3.json       → expressions/dark_face.exp3.json
    爱心眼.exp3.json     → expressions/heart_eyes.exp3.json
    眼罩.exp3.json       → expressions/blindfold.exp3.json    (눈가리개 토글)
    外套穿脱.exp3.json   → expressions/coat_toggle.exp3.json   (외투 탈착 토글)
    脸红.exp3.json       → expressions/blush.exp3.json
    长离.moc3/cdi3/physics3/model3.json → changli.*
    长离.4096/           → changli.4096/

- 원본 `长离.model3.json`은 `Groups.EyeBlink.Ids` / `Groups.LipSync.Ids`가 **비어있어** 립싱크·눈 깜빡임이 동작하지 않는 상태였습니다.
  `cdi3.json`에서 표준 파라미터 ID를 확인하여 다음과 같이 수동 보강했습니다:
    EyeBlink: ParamEyeLOpen, ParamEyeROpen
    LipSync : ParamMouthOpenY
- 원본에는 `Motions`이 정의되지 않아 기본 Idle 애니메이션이 없습니다. 향후 추가 가능.
- `icon.png`는 썸네일로 `model_registry.json`에 참조됨.
