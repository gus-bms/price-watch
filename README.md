# Price Watch (MVP)

Local price-tracking runner that polls product pages and alerts when a target price is met.
Runner is implemented with NestJS + TypeScript.
Runtime config and state are now persisted in MySQL.

## Runner Architecture (NestJS)

- Bootstrap: Nest application context (`src/main.ts`) for CLI-style execution.
- API server: `src/main.ts --api` starts HTTP API for UI.
- Modules/services: DB-backed config loading, state persistence, HTTP fetcher, parser, notifier, scheduler.
- Scheduler: per-item timers with exponential backoff + jitter on failures.
- Fetcher: HTTP GET with timeout and custom user-agent.
- Parser: regex or jsonPath (for JSON responses).
- State: MySQL tables (`watch_state`, `watch_check_run`, `watch_notification`).
- Notifier: console (replaceable with email/Slack/webhook later).

## Config

`config/watchlist.json`

Global fields:

- `defaultIntervalMinutes`
- `timeoutMs`
- `userAgent`
- `maxBackoffMinutes`
- `minNotifyIntervalMinutes`

Item fields:

- `id` (unique)
- `name`
- `url`
- `targetPrice`
- `currency` (optional)
- `parser`: `{ type: "regex", pattern, flags? }` or `{ type: "jsonPath", path }`
- `intervalMinutes` (optional, defaults to global)

## Prerequisites

- Node 20+
- Docker & Docker Compose

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start MySQL (Docker)
cp .env.example .env   # 필요 시 수정
npm run infra           # docker compose up -d

# 3. Run the app
npm run start           # scheduler mode
npm run once            # single check
npm run api             # HTTP API server
npm run check-config    # validate config
```

Production build:

```bash
npm run build
npm run start:prod
```

### Docker Commands

| Command                        | Description            |
| ------------------------------ | ---------------------- |
| `npm run infra`                | MySQL 컨테이너 시작    |
| `docker compose down`          | 컨테이너 중지          |
| `docker compose down -v`       | 컨테이너 + 데이터 삭제 |
| `docker compose logs -f mysql` | MySQL 로그 확인        |

Environment variables (see `.env.example`):

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `APP_HOST`, `APP_PORT`

## UI (React + Vite)

Dashboard lives in `ui/` and consumes API endpoints from the root service.

```bash
cd ui
npm install
npm run dev
```

Default ports:

- API: `http://localhost:4000`
- UI: `http://localhost:5173`

## Limitations

- HTML parsing is regex-based; no CSS selectors in MVP.
- JS-rendered pages are not supported (add a headless browser fetcher later).
- Respect site terms and rate limits.
