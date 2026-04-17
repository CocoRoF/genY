=== Frieren — Live2D Model ===

Character      : Frieren (フリーレン)
Origin IP      : 『葬送のフリーレン』 (Sousou no Frieren) — ©山田鐘人・アベツカサ／小学館／「葬送のフリーレン」製作委員会
Source         : 외부 무료 배포본 (원본 URL 미확인 — 이식 전 재확인 필요)
License        : 확인 중 — 팬 제작 파생물. 원작 저작권은 제작위원회에 귀속.
Commercial use : ❌ 확인되지 않음. 상업 이용 전 원작자/배포자 허가 필수.

=== Asset notes ===

- 원본 파일명은 대부분 ASCII(라틴)였으나 대소문자 및 경로 구조를 Geny 컨벤션에 맞춰 정규화했습니다.
- 원본 `Frieren.8192/texture_00.png`는 **256MB (8192×8192 RGBA, 비압축에 가까운 상태)** 로 GitHub 단일 파일 100MB 한도를 초과했습니다.
  macOS `sips`로 **4096×4096**으로 다운샘플링하여 2.4MB로 저장했으며, 폴더명도 `frieren.4096/`으로 변경했습니다.
  (다른 Geny 모델 — mao_pro.4096, huohuo.8192 — 의 관행 및 `VTUBER_AVATAR_CREATION_GUIDE.md` §3의 권장 해상도와 일치)
  원본 8192 해상도가 필요할 경우 Git LFS 도입을 별도로 검토해야 합니다.
- 모션 `daiji.motion3.json`은 의미가 "待机 (대기)" → `motions/idle.motion3.json`으로 리네이밍 확정.
- 모션 `zs1.motion3.json`은 의미 불명 → 원본 이름 유지.
- 표정 파일(14개: ku, yy, han, mmy, d, lks, bl, wh, zx, anya, anya2, anyazZZ, w, erd)은 중국어 핀인 약어로 추정되나 확실한 매핑 없이 잘못 번역하면 감정↔표정 불일치가 발생하므로 **원본명을 보존**했습니다.
- `anya*`는 원작과 무관한 "Anya (Spy×Family)" 크로스오버 표정으로 추정됩니다.
- Cubism Viewer 또는 프론트엔드 EmotionTester로 각 표정의 실제 효과를 확인한 후 `model_registry.json`의 `emotionMap`을 갱신해 주세요.
