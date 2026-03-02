# AI Worklog

## 2026-03-02 14:16 KST

### 요청
- 현재까지 작업사항 보고
- `docs/ai/worklog.md`에 작업 로그 작성

### 현재 변경 현황 (`git status` 기준)
- 브랜치: `main` (`origin/main` 대비 워킹트리 변경 존재)
- 추적 파일 변경: 26개 (`M` 15개, `D` 11개)
- 미추적 파일: 14개

### 핵심 작업 내역 요약
- 백엔드 런너의 설정/상태 저장소를 JSON 파일 기반에서 MySQL 기반으로 전환.
- DB 레이어 추가: `src/database/database.service.ts`에서 풀/트랜잭션/쿼리 유틸 제공.
- 런너 확장: `src/main.ts --api` 플래그로 API 서버 부팅 경로 추가.
- API 추가: `src/api/server.ts`, `src/api/watch-items.service.ts`
- API 기능: 아이템 CRUD, 단건 체크(`/api/check`), 체크 결과/실패 이력 기록.
- 상태/이력 스키마 추가: `db/schema.mysql.sql`
- 설정 예시 추가: `.env.example`, `ui/.env.example`
- UI 전환: `ui/`를 Next.js에서 React + Vite 구조로 마이그레이션.
- UI 기능: 아이템 생성/수정/삭제, 수동 체크, 패턴 프리셋 기반 폼, 상태 표시.
- 문서 갱신: 루트 `README.md`, `ui/README.md`를 DB/API/Vite 기준으로 업데이트.

### 이번 턴에서 수행한 작업
- 전체 워킹트리 변경 파일과 diff 통계를 점검해 작업 범위를 재정리.
- 백엔드/DB/API/UI 주요 파일을 확인해 작업 항목을 카테고리별로 요약.
- 본 워크로그 파일 신규 작성.

### 남은 점검 항목
- 루트 런너/API 실행 점검(`npm run start`, `npm run api`).
- UI 빌드 및 실행 점검(`cd ui && npm run dev`, `npm run build`).
- DB 스키마 적용 및 실제 연동 확인(`db/schema.mysql.sql`).
