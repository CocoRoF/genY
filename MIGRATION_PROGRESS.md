# Migration Progress Tracker

## Phase 0: geny-executor 기능 확장

| Task | 상태 | 파일 |
|------|------|------|
| 0-4: ToolContext 확장 | **DONE** | `tools/base.py` — storage_path, env_vars, allowed_paths 추가 |
| 0-1: 빌트인 도구 구현 | **DONE** | `tools/built_in/` — Read,Write,Edit,Bash,Glob,Grep + 6/6 테스트 통과 |
| 0-2: MCP 완전 구현 | **DONE** | `tools/mcp/manager.py` — stdio/HTTP transport, tool discovery, call_tool 구현 |
| 0-3: 세션 지속성 | **DONE** | `session/persistence.py` — FileSessionPersistence, save/load/delete 테스트 통과 |

## Phase 1: Geny 백엔드 통합

| Task | 상태 | 파일 |
|------|------|------|
| 1-1: Pipeline-Only 전환 | **DONE** | _build_graph → _build_pipeline only, LangGraph path 제거 (-332 lines) |
| 1-2: CLI spawn 제거 | **DONE** | initialize()에서 ClaudeCLIChatModel 제거 |
| 1-3: revive() 수정 | **DONE** | ClaudeProcess 재생성 → Pipeline rebuild만 |
| 1-4: session_manager 정리 | PENDING | `agent_session_manager.py` |
| 1-5: _build_pipeline() 수정 | **DONE** | 빌트인 도구 6종 자동 등록, API key 필수 |

## Phase 2: CLI 의존성 제거

| Task | 상태 | 파일 |
|------|------|------|
| 2-1: 레거시 파일 삭제 | PENDING | 다수 |
| 2-2: Dockerfile 정리 | PENDING | `Dockerfile` |
| 2-3: docker-compose 정리 | PENDING | `docker-compose.*.yml` |

## Phase 3: 스트리밍 통합

| Task | 상태 | 파일 |
|------|------|------|
| 3-1: Pipeline 이벤트 → session_logger | PENDING | `agent_session.py` |
| 3-2: broadcast thinking_preview | PENDING | `chat_controller.py` |
