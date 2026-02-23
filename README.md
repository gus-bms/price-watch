# Price Watch (MVP)

Local price-tracking runner that polls product pages and alerts when a target price is met.
Runner is implemented with NestJS + TypeScript.

## Runner Architecture (NestJS)
- Bootstrap: Nest application context (`src/main.ts`) for CLI-style execution.
- Modules/services: config loading, state persistence, HTTP fetcher, parser, notifier, scheduler.
- Scheduler: per-item timers with exponential backoff + jitter on failures.
- Fetcher: HTTP GET with timeout and custom user-agent.
- Parser: regex or jsonPath (for JSON responses).
- State: local JSON file to avoid repeat notifications.
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

## Usage
Requires Node 20+.

```bash
npm install
npm run start
npm run once
npm run check-config
```

Production build:

```bash
npm run build
npm run start:prod
```

Optional flags:
- `--config /path/to/watchlist.json`
- `--state /path/to/state.json`

## UI (Next.js)
Dashboard lives in `ui/` and reads the same local JSON files.

```bash
cd ui
npm install
npm run dev
```

The UI expects:
- `config/watchlist.json`
- `data/state.json`

## Limitations
- HTML parsing is regex-based; no CSS selectors in MVP.
- JS-rendered pages are not supported (add a headless browser fetcher later).
- Respect site terms and rate limits.
