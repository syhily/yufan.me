# Blog Analytics Implementation Plan

> A pixel-faithful React port of [Sink](https://github.com/ccbikai/Sink)'s analytics dashboard, backed by PostgreSQL + TimescaleDB instead of Cloudflare Analytics Engine.

**Status:** Approved, awaiting execution
**Author:** Drafted with Claude, decisions confirmed by Yufan Sheng on 2026-05-14
**Target repo:** `/Users/YufanSheng/SourceCode/xiaoyu/yufan.me`
**Reference repo:** `/Users/YufanSheng/SourceCode/xiaoyu/Sink`

---

## 1. Goal

Add a visitor analytics module to the personal blog `yufan.me`, matching the visual design of Sink's dashboard 1:1, but built on the blog's existing stack (React Router v7, Drizzle, PostgreSQL).

- **Reuse** Sink's UX/visual language (counters with rolling numbers, area+line chart, 7×24 heatmap, 5-group metric tables, realtime feed)
- **Replace** Sink's storage layer (Cloudflare Workers Analytics Engine) with PostgreSQL + TimescaleDB
- **Preserve** the blog's existing `metric` table and `bumpPageView` flow (front-end "阅读量" display stays untouched)

---

## 2. Context Recap

### 2.1 The blog stack (`yufan.me`)

| Aspect | Reality | Implication |
|---|---|---|
| Framework | **React Router v7.15** (full-stack SSR) — `react-router-serve` | Use loaders/actions, not separate API routes |
| Runtime | **Node 25 in Docker**, port 4321, single process | Direct in-process batching is safe |
| Database | **PostgreSQL + Drizzle ORM v1.0.0-rc.2** | Add TimescaleDB extension on existing PG |
| Cache | Redis (`ioredis`) | Useful for SSE pub/sub, rate limiting |
| Existing analytics | `metric` table (per-entity PV counter) + `PageViewBatcher` (in-memory) | Counter-only; no time-series, no dimensions |
| Auth | Full RBAC + Redis sessions + `wp-admin.*` routes | Reuse for dashboard protection |
| Styling | Tailwind v4 + Base UI + CVA + clsx | No shadcn — build custom UI primitives |
| Charts | **None** | New dependency |
| i18n | None (Chinese-only) | Drop `t()` calls from Sink |
| Posts | DB-backed, Portable Text | Use `post.id` (bigint) as `post_id` foreign key |
| Network entry | **Bare Node port, no reverse proxy** | No `CF-*` / `X-Real-IP` reliable — need local MaxMind |

Key paths:
- `src/server/db/schema.ts` — Drizzle schema (existing `metric` table at L22-L62)
- `src/server/db/pool.ts` — PG connection
- `src/server/metrics/batcher.ts` — existing `PageViewBatcher`
- `src/server/auth/` — sessions, RBAC, CSRF
- `src/routes/wp-admin.*.tsx` — existing admin routes
- `src/ui/admin/` — admin UI components
- `drizzle/` — Drizzle migrations

### 2.2 How Sink does it (key files)

#### Write path
- `server/middleware/1.redirect.ts:148` — Calls `useAccessLog(event)` in try/catch before `sendRedirect`
- `server/utils/access-log.ts:95-158` — Parses UA (`ua-parser-js` + extensions), reads `cloudflare.request.cf` for geo, calls `env.ANALYTICS.writeDataPoint({ indexes, blobs, doubles })`
- **Bot filter:** `disableBotAccessLog` flag; uses `cf.botManagement.verifiedBot` + UA heuristics (`server/utils/access-log.ts:117-125`)

#### Storage model (WAE)
- 1 index slot: `link.id`
- 16 blobs: `slug, url, ua, ip, referer, country, region, city, timezone, language, os, browser, browserType, device, deviceType, COLO`
- 2 doubles: `latitude, longitude`
- Blob/double maps: `server/utils/access-log.ts:21-38`

#### Read path (4 stats endpoints)
- `server/api/stats/counters.get.ts` — `SUM(_sample_interval) AS visits`, weighted distinct for visitors/referers
- `server/api/stats/views.get.ts` — `formatDateTime(timestamp, '%Y-%m-%d %H', tz) AS time GROUP BY time`
- `server/api/stats/heatmap.get.ts` — `toDayOfWeek(tz_ts), toHour(tz_ts) GROUP BY weekday, hour`
- `server/api/stats/metrics.get.ts` — Generic `GROUP BY <blob_n>` with `?type=country|browser|...`
- `server/api/stats/[action].get.ts` — CSV export
- `server/utils/query-filter.ts` — Composes `WHERE` clauses from query string filters
- `server/utils/cloudflare.ts:3` — `useWAE(event, sql)` — POSTs SQL to `https://api.cloudflare.com/client/v4/accounts/{id}/analytics_engine/sql`

#### Front-end (Vue, to be ported)
- `layers/dashboard/app/pages/dashboard/analysis.vue` — Page shell
- `layers/dashboard/app/components/dashboard/analysis/Index.vue` — Layout (Counters + Tabs(Views|Heatmap) + Metrics)
- `layers/dashboard/app/components/dashboard/analysis/Counters.vue` — 3 cards using `@number-flow/vue`
- `layers/dashboard/app/components/dashboard/analysis/Views.vue` — `@unovis/vue` VisArea+VisLine / VisGroupedBar
- `layers/dashboard/app/components/dashboard/analysis/Heatmap.vue` — Pure CSS Grid 7×24, `color-mix()` intensity
- `layers/dashboard/app/components/dashboard/analysis/metrics/` — 5 groups: location / referer / time / device / browser
- `layers/dashboard/app/composables/analysis.ts` — Pinia store; URL sync of `time` / `preset` / `filters` query params
- `layers/dashboard/app/components/dashboard/realtime/` — Globe + chart + logs (we're skipping the globe)

#### Sink-specific traits NOT to port
- `_sample_interval` weighted distinct math — WAE samples under load; **PostgreSQL doesn't sample**, drop this
- WebGL globe (Three.js + custom shaders) — out of scope for v1
- Cloudflare-specific bindings — replaced with Node equivalents

---

## 3. Decisions Recorded

All seven decisions, with the chosen option and rationale.

### D1. Collection mode → **Server-side打点 (SSR loader)**
Same approach as Sink. Server-side write in the appropriate React Router loader. No client beacon. Captures basic PV/UV + path + referer + UA + IP + language. Does **not** capture dwell time or scroll depth — accepted trade-off.

### D2. Reverse proxy → **None (bare Node port)**
No `CF-IPCountry` / `X-Real-IP` headers can be trusted. Need local IP geolocation via **MaxMind GeoLite2** (`@maxmind/geoip2-node`) with a `GeoLite2-City.mmdb` file. Update strategy: weekly cron pulling fresh DB.

### D3. Raw IP handling → **Store raw IP (`inet`)**
User accepted the compliance trade-off explicitly. Implications and mitigations:
- The dashboard **must** be behind the existing admin auth + RBAC
- Add an audit log entry when an admin views the analytics dashboard (defer to phase 4 if needed)
- Do NOT log full IPs to console / error trackers
- Do NOT expose IPs in any public API
- Keep retention reasonable (180 days, see schema)

### D4. Realtime module → **Simple list + live line chart**
Server-Sent Events stream. No WebGL globe. Roughly: a right-side "most recent 50 events" log feed + a top live mini line chart of last 5 minutes.

### D5. Chart library → **`@unovis/react`**
Same vendor as Sink's `@unovis/vue`. API is essentially identical → Sink's `Views.vue` translates almost line-for-line. Heatmap stays as plain CSS Grid (no chart lib needed). Counters use **`@number-flow/react`** for the rolling-digit animation.

### D6. Route path → **`/wp-admin/analytics`**
Distinguishes from existing `metric` table (which the blog calls "counter"). Matches Sink's terminology (`analysis` page). Sub-routes:
- `/wp-admin/analytics` — Overview (Counters + Trend/Heatmap + 5 metric groups)
- `/wp-admin/analytics/realtime` — Realtime feed
- `/wp-admin/analytics/posts/:slug` — Per-post drill-down (phase 4)

### D7. PV counter dual-write → **Yes, write both**
The track entry point does two things in parallel:
1. Push to `AccessLogBatcher` → eventually written to `access_log` hypertable
2. Call existing `bumpPageView(target)` → increments `metric.pv`

Front-end "阅读量" display logic is **not touched**. Back-office dashboard queries the new `access_log` table.

---

## 4. Architecture

```
┌─────────── Request (browser/bot) ───────────────────────┐
│                                                          │
│ GET /posts/:slug                                         │
│                                                          │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────── React Router server (Node SSR) ──────────────┐
│                                                          │
│ post.$slug.tsx  (or root loader for site-wide)          │
│   ↓                                                      │
│ try { trackAccess(request, { type:'post', id }) }       │
│ catch { log; never block render }                       │
│   ↓                                                      │
│ ┌─── trackAccess() ────────────────────────────────┐   │
│ │  1. enrichEvent(request)                          │   │
│ │       - parse UA (ua-parser-js + extensions)      │   │
│ │       - resolve IP geo (MaxMind reader, lazy)     │   │
│ │       - bot detection (isbot + UA heuristics)     │   │
│ │  2. if bot && disableBotLog: return               │   │
│ │  3. accessLogBatcher.push(event)                  │   │
│ │  4. bumpPageView(target)  // existing flow        │   │
│ └───────────────────────────────────────────────────┘   │
│   ↓                                                      │
│ render(<Component/>)                                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─── AccessLogBatcher (in-process) ───────────────────────┐
│ - buffer events in Map<correlation_key, Event[]>         │
│ - flush triggers:                                        │
│     - bufferSize >= 100                                  │
│     - 1s since last flush                                │
│     - SIGTERM/SIGINT/beforeExit                          │
│ - flush impl: COPY INTO access_log (pg-copy-streams)     │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─── PostgreSQL + TimescaleDB ────────────────────────────┐
│                                                          │
│ access_log (hypertable, 1-day chunk_time_interval)      │
│   ts / visitor_hash / session_id / path / post_id /     │
│   ip(inet) / referer / referer_host /                   │
│   country / region / city / language /                  │
│   ua / browser / os / device_type / is_bot / ...        │
│                                                          │
│ Continuous Aggregates:                                  │
│   - stats_hourly  (24h refresh, last 30d)               │
│   - stats_daily   (1h refresh, full history)            │
│                                                          │
│ Policies:                                               │
│   - compression: > 7 days                                │
│   - retention:   > 180 days                              │
│                                                          │
│ Existing tables (untouched):                            │
│   - metric (pv counter)                                  │
│   - post / page / comment / ...                          │
└──────────────────────────────────────────────────────────┘
                            ▲
                            │ SQL via Drizzle pool
                            │
┌─── Admin dashboard ─────────────────────────────────────┐
│                                                          │
│ /wp-admin/analytics                                     │
│   - DateRangePicker + Filters (URL-synced)              │
│   - Counters (visits/visitors/referers)                 │
│   - Tabs: Trend / Heatmap                               │
│   - 5 MetricGroups: location/referer/time/device/browser│
│                                                          │
│ /wp-admin/analytics/realtime                            │
│   - SSE stream → live log list + mini chart             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 5. New Dependencies

To add via `pnpm add` (or whatever `vp` proxies to):

```bash
# Runtime
@unovis/react          # Chart primitives (Sink uses @unovis/vue)
@number-flow/react     # Counter rolling-digit animation
ua-parser-js           # User-agent parsing (Sink uses the same)
@maxmind/geoip2-node   # GeoLite2 mmdb reader
pg-copy-streams        # COPY-based batch writes (faster than INSERT)

# Already present, just confirming
isbot                  # ✓ already in package.json
ioredis                # ✓ already present
drizzle-orm            # ✓
```

Optional later:
- `intl-parse-accept-language` — parsing `Accept-Language` header (Sink uses it)

### MaxMind setup

1. Register a free account at https://www.maxmind.com/en/geolite2/signup
2. Generate a license key
3. Download `GeoLite2-City.mmdb` (and optionally `GeoLite2-ASN.mmdb`)
4. Place at `data/maxmind/GeoLite2-City.mmdb` (gitignored)
5. Add `MAXMIND_DB_PATH` env var
6. Add a weekly cron (host-side cron or a Node `node-cron` job) to refresh

---

## 6. Schema

### 6.1 Drizzle definition

Append to `src/server/db/schema.ts`:

```typescript
// Append-only time-series access log.
// Backed by a TimescaleDB hypertable created in a follow-up migration.
// NOT softly deletable (retention handled by Timescale policy).
export const accessLog = pgTable(
  'access_log',
  {
    // ts is the primary partition key for the hypertable; no surrogate PK.
    ts: timestamp('ts', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),

    // Per-day-rotating salt'd hash of IP. Stable within a UTC day,
    // anonymous across days. Used for UV counting.
    visitorHash: text('visitor_hash').notNull(),

    // Short cookie ID (httpOnly, 30-day TTL) issued on first request.
    // Useful for cross-day stickiness if we ever need it.
    sessionId: text('session_id'),

    // Raw IP. Compliance/legal accepted by user. Keep behind admin auth.
    ip: inet('ip'),

    // Request target
    path: text('path').notNull(),
    postId: bigint('post_id', { mode: 'bigint' }), // null = non-post page

    // Referer (full + parsed host)
    referer: text('referer'),
    refererHost: text('referer_host'),

    // Geo (via MaxMind)
    country: text('country'),
    region: text('region'),
    city: text('city'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    timezone: text('timezone'),

    // Locale
    language: text('language'),

    // UA-derived
    ua: text('ua'),
    browser: text('browser'),
    browserVersion: text('browser_version'),
    os: text('os'),
    osVersion: text('os_version'),
    device: text('device'),       // model
    deviceType: text('device_type'), // mobile|tablet|desktop|bot|...

    // Bot flag (after isbot + UA heuristics)
    isBot: boolean('is_bot').notNull().default(false),
  },
  (table) => [
    // Compound indexes covering common queries.
    // Note: Timescale auto-creates (ts DESC) per chunk.
    index('idx_access_log_post_ts').on(table.postId, table.ts),
    index('idx_access_log_path_ts').on(table.path, table.ts),
    index('idx_access_log_country_ts').on(table.country, table.ts),
    index('idx_access_log_visitor_ts').on(table.visitorHash, table.ts),
  ],
)
```

> Note: `inet` and `doublePrecision` come from `drizzle-orm/pg-core`. Add to imports.

### 6.2 Drizzle-generated migration

Run `pnpm db:generate` after editing the schema. Will produce a file like `drizzle/00xx_access_log.sql` containing `CREATE TABLE access_log (...)`.

### 6.3 Hand-written Timescale migration

Add a follow-up file `drizzle/00xx_access_log_timescale.sql` (sequence number = Drizzle-generated + 1):

```sql
-- Enable extension if not already
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert to hypertable (1-day chunks)
SELECT create_hypertable(
  'access_log', 'ts',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE,
  migrate_data => TRUE
);

-- Compression: column-oriented compression for old chunks
ALTER TABLE access_log SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'post_id',
  timescaledb.compress_orderby   = 'ts DESC'
);
SELECT add_compression_policy('access_log', INTERVAL '7 days');

-- Retention: drop chunks older than 180 days
SELECT add_retention_policy('access_log', INTERVAL '180 days');

-- Hourly continuous aggregate (used for charts > 24h ranges)
CREATE MATERIALIZED VIEW stats_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', ts) AS bucket,
  post_id,
  path,
  country,
  browser,
  os,
  device_type,
  COUNT(*)                       AS visits,
  COUNT(DISTINCT visitor_hash)   AS visitors,
  COUNT(DISTINCT referer_host)
    FILTER (WHERE referer_host IS NOT NULL AND referer_host <> '') AS referers
FROM access_log
WHERE is_bot = FALSE
GROUP BY bucket, post_id, path, country, browser, os, device_type;

SELECT add_continuous_aggregate_policy('stats_hourly',
  start_offset      => INTERVAL '24 hours',
  end_offset        => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes');

-- Daily continuous aggregate (used for charts > 30d ranges)
CREATE MATERIALIZED VIEW stats_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', ts) AS bucket,
  post_id,
  path,
  country,
  COUNT(*)                       AS visits,
  COUNT(DISTINCT visitor_hash)   AS visitors
FROM access_log
WHERE is_bot = FALSE
GROUP BY bucket, post_id, path, country;

SELECT add_continuous_aggregate_policy('stats_daily',
  start_offset      => INTERVAL '7 days',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');
```

> **Migration execution note**: Drizzle's migrator runs `.sql` files in alphabetical order. Naming the Timescale file with the next sequence number ensures it runs right after the table creation.

---

## 7. Phase 0 — Infrastructure

**Goal:** PG ready, schema in place, mmdb in place, dependencies installed.

### Tasks

- [ ] **DB**: Install TimescaleDB extension on the PG server
  - If using `timescale/timescaledb-ha:pg17` image, already bundled
  - Else: follow install instructions for the host OS; `CREATE EXTENSION timescaledb`
  - Verify: `SELECT extversion FROM pg_extension WHERE extname='timescaledb'`

- [ ] **MaxMind**: Register, download `GeoLite2-City.mmdb`
  - Place at `data/maxmind/GeoLite2-City.mmdb`
  - Add `data/maxmind/` to `.gitignore`
  - Add env vars: `MAXMIND_DB_PATH=./data/maxmind/GeoLite2-City.mmdb`

- [ ] **Dependencies**: `pnpm add @unovis/react @number-flow/react ua-parser-js @maxmind/geoip2-node pg-copy-streams intl-parse-accept-language`

- [ ] **Schema**: Append `accessLog` definition to `src/server/db/schema.ts`
  - Verify it picks up `inet` / `doublePrecision` imports

- [ ] **Migrations**: `pnpm db:generate` → produces table-creation SQL. Then hand-write the Timescale companion file.

- [ ] **Smoke test**: Run migration locally; insert 10 fake rows; verify hypertable shows chunks (`SELECT * FROM timescaledb_information.chunks WHERE hypertable_name='access_log'`).

### Files to touch

- `src/server/db/schema.ts` — append
- `drizzle/00xx_access_log.sql` — Drizzle-generated
- `drizzle/00xx_access_log_timescale.sql` — hand-written
- `package.json` — new deps
- `.gitignore` — `data/maxmind/`
- `.env.example` — `MAXMIND_DB_PATH`

---

## 8. Phase 1 — Ingestion Pipeline

**Goal:** Track every request to a content page, batch-write to `access_log`, double-write to existing `metric.pv`.

### 8.1 Module layout (new directory)

```
src/server/analytics/
├── enrich.ts        # UA parse + IP geo + bot detection + visitor hash
├── batcher.ts       # AccessLogBatcher (in-memory buffer + COPY flush)
├── salt.ts          # Daily salt rotation (in-memory, regenerated daily)
├── track.ts         # Main entry: trackAccess(request, target)
├── geoip.ts         # MaxMind reader singleton
└── types.ts         # AccessEvent type
```

### 8.2 Key code sketches

**`src/server/analytics/types.ts`**
```typescript
import type { EntityTarget } from '@/server/db/target'

export interface RawAccessEvent {
  ts: Date
  ip: string
  ua: string
  path: string
  referer: string | null
  acceptLanguage: string | null
  target: EntityTarget | null  // null for non-content pages
  sessionId: string | null
}

export interface EnrichedAccessEvent {
  ts: Date
  visitorHash: string
  sessionId: string | null
  ip: string
  path: string
  postId: bigint | null
  referer: string | null
  refererHost: string | null
  country: string | null
  region: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
  language: string | null
  ua: string
  browser: string | null
  browserVersion: string | null
  os: string | null
  osVersion: string | null
  device: string | null
  deviceType: string | null
  isBot: boolean
}
```

**`src/server/analytics/salt.ts`**
```typescript
import { randomBytes } from 'node:crypto'

let currentSalt = randomBytes(32).toString('hex')
let currentDay = new Date().toISOString().slice(0, 10)

export function getDailySalt(): string {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== currentDay) {
    currentSalt = randomBytes(32).toString('hex')
    currentDay = today
  }
  return currentSalt
}
```
> Note: In-memory salt means UV counts reset across process restarts. Acceptable for a personal blog. For stricter correctness, persist daily salt in Redis.

**`src/server/analytics/geoip.ts`**
```typescript
import { Reader } from '@maxmind/geoip2-node'
import { env } from '@/shared/env'  // existing env wrapper

let reader: Reader | null = null
let loadPromise: Promise<Reader> | null = null

export async function getGeoReader(): Promise<Reader | null> {
  if (reader) return reader
  if (!env.MAXMIND_DB_PATH) return null
  if (!loadPromise) {
    loadPromise = Reader.open(env.MAXMIND_DB_PATH)
  }
  reader = await loadPromise
  return reader
}

export async function lookupCity(ip: string) {
  const r = await getGeoReader()
  if (!r) return null
  try { return r.city(ip) } catch { return null }
}
```

**`src/server/analytics/enrich.ts`** — Mirrors Sink's `access-log.ts`
```typescript
import { createHash } from 'node:crypto'
import { isbot } from 'isbot'
import { UAParser } from 'ua-parser-js'
import { parseAcceptLanguage } from 'intl-parse-accept-language'
import { lookupCity } from './geoip'
import { getDailySalt } from './salt'
import type { RawAccessEvent, EnrichedAccessEvent } from './types'

function hashIp(ip: string): string {
  return createHash('sha256').update(ip + getDailySalt()).digest('hex').slice(0, 32)
}

function parseRefererHost(referer: string | null): string | null {
  if (!referer) return null
  try { return new URL(referer).host || null } catch { return null }
}

export async function enrichEvent(raw: RawAccessEvent): Promise<EnrichedAccessEvent> {
  const ua = raw.ua || ''
  const uaParser = new UAParser(ua)
  const uaResult = uaParser.getResult()
  const language = parseAcceptLanguage(raw.acceptLanguage ?? '')[0] ?? null
  const geo = raw.ip ? await lookupCity(raw.ip) : null

  const isBot = isbot(ua)
    || ['crawler', 'fetcher', 'spider', 'bot'].includes(uaResult.browser.type ?? '')

  return {
    ts: raw.ts,
    visitorHash: hashIp(raw.ip),
    sessionId: raw.sessionId,
    ip: raw.ip,
    path: raw.path,
    postId: raw.target?.type === 'post' ? raw.target.id : null,
    referer: raw.referer,
    refererHost: parseRefererHost(raw.referer),
    country: geo?.country?.isoCode ?? null,
    region: geo?.subdivisions?.[0]?.names?.en ?? null,
    city: geo?.city?.names?.en ?? null,
    latitude: geo?.location?.latitude ?? null,
    longitude: geo?.location?.longitude ?? null,
    timezone: geo?.location?.timeZone ?? null,
    language,
    ua,
    browser: uaResult.browser.name ?? null,
    browserVersion: uaResult.browser.version ?? null,
    os: uaResult.os.name ?? null,
    osVersion: uaResult.os.version ?? null,
    device: uaResult.device.model ?? null,
    deviceType: uaResult.device.type ?? 'desktop',
    isBot,
  }
}
```
> Open question: `visitorHash` currently hashes both IP and salt, but we **also store raw IP**. The hash is redundant in this case — but kept because UV grouping by hash is faster than `COUNT(DISTINCT ip)` over `inet`, and it survives a future "remove raw IP" pivot without breaking dashboards.

**`src/server/analytics/batcher.ts`** — Mirrors `src/server/metrics/batcher.ts` pattern
```typescript
import { from as copyFrom } from 'pg-copy-streams'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { db } from '@/server/db/pool'
import { getLogger } from '@/server/logger'
import type { EnrichedAccessEvent } from './types'

const log = getLogger('analytics.batcher')

interface Options {
  flushIntervalMs: number
  flushThreshold: number
}

class AccessLogBatcher {
  private buffer: EnrichedAccessEvent[] = []
  private timer: NodeJS.Timeout | null = null
  private flushing: Promise<void> | null = null

  constructor(private readonly opts: Options) {
    const onShutdown = () => { void this.flush().catch(() => {}) }
    process.once('SIGTERM', onShutdown)
    process.once('SIGINT', onShutdown)
    process.once('beforeExit', onShutdown)
  }

  push(event: EnrichedAccessEvent): void {
    this.buffer.push(event)
    if (this.buffer.length >= this.opts.flushThreshold) {
      void this.flush()
      return
    }
    if (this.timer === null) {
      this.timer = setTimeout(() => void this.flush(), this.opts.flushIntervalMs)
      this.timer.unref?.()
    }
  }

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing
    if (this.buffer.length === 0) return

    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    const snapshot = this.buffer
    this.buffer = []

    this.flushing = (async () => {
      try {
        await copyEvents(snapshot)
        log.debug('flushed access log', { count: snapshot.length })
      } catch (err) {
        log.error('flush failed; restoring buffer', { err: String(err), count: snapshot.length })
        this.buffer.unshift(...snapshot)
      } finally {
        this.flushing = null
      }
    })()

    return this.flushing
  }
}

async function copyEvents(events: EnrichedAccessEvent[]) {
  // Acquire a raw pg client from drizzle's pool
  const client = await db.$client.connect()
  try {
    const stream = client.query(copyFrom(`
      COPY access_log (
        ts, visitor_hash, session_id, ip, path, post_id,
        referer, referer_host, country, region, city,
        latitude, longitude, timezone, language,
        ua, browser, browser_version, os, os_version,
        device, device_type, is_bot
      ) FROM STDIN WITH (FORMAT csv, NULL '\\N')
    `))
    const lines = events.map(e => csvRow([
      e.ts.toISOString(), e.visitorHash, e.sessionId, e.ip, e.path, e.postId?.toString(),
      e.referer, e.refererHost, e.country, e.region, e.city,
      e.latitude?.toString(), e.longitude?.toString(), e.timezone, e.language,
      e.ua, e.browser, e.browserVersion, e.os, e.osVersion,
      e.device, e.deviceType, e.isBot ? 'true' : 'false',
    ]))
    await pipeline(Readable.from(lines), stream)
  } finally {
    client.release()
  }
}

// CSV escaper that emits \N for null
function csvRow(cols: Array<string | null | undefined>): string {
  return cols.map(c => {
    if (c === null || c === undefined) return '\\N'
    const needsQuote = /[",\n\r]/.test(c)
    const escaped = c.replace(/"/g, '""')
    return needsQuote ? `"${escaped}"` : escaped
  }).join(',') + '\n'
}

const GLOBAL_KEY = Symbol.for('yufan.me/access-log-batcher')
type Holder = { [GLOBAL_KEY]?: AccessLogBatcher }
const holder = globalThis as Holder

export function getAccessLogBatcher(): AccessLogBatcher {
  if (!holder[GLOBAL_KEY]) {
    holder[GLOBAL_KEY] = new AccessLogBatcher({
      flushIntervalMs: 1000,
      flushThreshold: 100,
    })
  }
  return holder[GLOBAL_KEY]!
}

export function flushAccessLog(): Promise<void> {
  return getAccessLogBatcher().flush()
}
```

> **Drizzle pool note**: Confirm the exact way to grab a raw `pg` client from drizzle-orm's pool. With `drizzle({ client: pool })` setup, `db.$client` typically exposes the underlying `Pool`. If the existing `pool.ts` exports the raw pool, prefer importing that directly.

**`src/server/analytics/track.ts`**
```typescript
import type { Request } from '@react-router/node'
import type { EntityTarget } from '@/server/db/target'
import { bumpPageView } from '@/server/metrics/batcher'
import { enrichEvent } from './enrich'
import { getAccessLogBatcher } from './batcher'
import { getLogger } from '@/server/logger'

const log = getLogger('analytics.track')

// Single env flag to disable bot logging
const DISABLE_BOT_LOG = process.env.ANALYTICS_DISABLE_BOT_LOG !== 'false'

export async function trackAccess(
  request: Request,
  target: EntityTarget | null,
): Promise<void> {
  try {
    const headers = request.headers
    const url = new URL(request.url)
    const ip = getClientIp(request)
    if (!ip) return  // Cannot identify; bail.

    const event = await enrichEvent({
      ts: new Date(),
      ip,
      ua: headers.get('user-agent') ?? '',
      path: url.pathname,
      referer: headers.get('referer') ?? null,
      acceptLanguage: headers.get('accept-language') ?? null,
      target,
      sessionId: readSessionId(headers),
    })

    if (event.isBot && DISABLE_BOT_LOG) return

    getAccessLogBatcher().push(event)
    if (target) bumpPageView(target)  // existing flow
  } catch (err) {
    log.error('trackAccess failed', { err: String(err) })
  }
}

function getClientIp(request: Request): string | null {
  // Bare Node, no reverse proxy → trust the socket address
  // React Router exposes the underlying request differently per platform
  // Likely: request.headers.get('x-forwarded-for') ?? Reflect.get(request, 'socket')?.remoteAddress
  // TODO: verify how RR v7 exposes the remote address; may need a small adapter.
  return null  // placeholder
}

function readSessionId(headers: Headers): string | null {
  const cookie = headers.get('cookie')
  if (!cookie) return null
  const m = cookie.match(/(?:^|; *)yf_aid=([^;]+)/)
  return m ? m[1] : null
}
```

> **Action item: confirm RR v7 raw socket access.** May need a small custom-server entry to forward `req.socket.remoteAddress` into the loader context.

### 8.3 Wiring into loaders

Insert into existing post/page route loaders:

```typescript
// src/routes/posts.$slug.tsx (or wherever a post is rendered)
export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const post = await getPostBySlug(params.slug)
  if (!post) throw new Response('Not found', { status: 404 })

  // Fire and forget — never blocks render
  void trackAccess(request, { type: 'post', id: post.id })

  return { post }
}
```

For homepage and other pages, call `trackAccess(request, null)`.

### 8.4 Session cookie

Add a tiny middleware (or in root loader) that issues an `yf_aid` cookie if missing:
- httpOnly, sameSite=Lax, Path=/, Max-Age=30 days
- Random short ID (`nanoid(12)` or `crypto.randomBytes(8).toString('hex')`)
- Used by `readSessionId` above

---

## 9. Phase 2 — Query API

**Goal:** Replicate Sink's `/api/stats/*` endpoints, adapted to PG + Drizzle.

### 9.1 Endpoints (React Router resource routes)

| Path | Loader returns | Notes |
|---|---|---|
| `api/analytics/counters` | `{ visits, visitors, referers }` | `SUM` + `COUNT(DISTINCT)` |
| `api/analytics/views` | `[{ time, visits, visitors }]` | `time_bucket` by minute/hour/day |
| `api/analytics/heatmap` | `[{ weekday, hour, visits, visitors }]` | `EXTRACT(dow), EXTRACT(hour) FROM ts AT TIME ZONE $tz` |
| `api/analytics/metrics?type=country&limit=10` | `[{ name, count }]` | Generic `GROUP BY` |
| `api/analytics/events?since=...` | SSE stream of latest events | Realtime feed |
| `api/analytics/export?format=csv` | CSV download | Stretch goal |

### 9.2 Shared query helpers

`src/server/analytics/query.ts`:
- `parseQueryParams(searchParams)` → typed `{ startAt, endAt, filters, postId }`
- `buildWhereClause(query)` → Drizzle SQL fragment with all filters applied
- `pickTimeBucket(startAt, endAt)` → `'1 minute' | '1 hour' | '1 day'`
- `pickAggregate(unit)` → `'access_log' | 'stats_hourly' | 'stats_daily'`
  - 24h range → `access_log` (precise)
  - 30d range → `stats_hourly` (CAG)
  - longer → `stats_daily` (CAG)

### 9.3 Sample loader

```typescript
// src/routes/api.analytics.views.tsx
import type { Route } from './+types/api.analytics.views'
import { requireAdmin } from '@/server/auth/guards'
import { db } from '@/server/db/pool'
import { sql } from 'drizzle-orm'
import { parseQueryParams, buildWhereClause, pickTimeBucket } from '@/server/analytics/query'

export const loader = async ({ request }: Route.LoaderArgs) => {
  await requireAdmin(request)
  const query = parseQueryParams(new URL(request.url).searchParams)
  const bucket = pickTimeBucket(query.startAt, query.endAt)
  const where = buildWhereClause(query)

  const rows = await db.execute(sql`
    SELECT
      time_bucket(${bucket}::interval, ts AT TIME ZONE ${query.tz}) AS time,
      COUNT(*)::int AS visits,
      COUNT(DISTINCT visitor_hash)::int AS visitors
    FROM access_log
    WHERE ${where}
      AND ts >= to_timestamp(${query.startAt})
      AND ts <= to_timestamp(${query.endAt})
      AND is_bot = FALSE
    GROUP BY time
    ORDER BY time
  `)

  return Response.json({ data: rows.rows })
}
```

> All loaders MUST gate with `requireAdmin(request)` reusing existing auth.

### 9.4 SSE realtime

`src/routes/api.analytics.events.tsx`:
- Loader returns a `Response` with `Content-Type: text/event-stream`
- Body is a `ReadableStream` that:
  - Subscribes to a Redis pub/sub channel `analytics:events`
  - `AccessLogBatcher.flush()` publishes batches to that channel
  - Forwards each event as `data: {json}\n\n`
- Closes on `request.signal.aborted`

> **Alternative**: poll `access_log` every 2s with `ts > last_seen`. Simpler, no Redis pub/sub. Pick this if Redis pub/sub feels heavy.

---

## 10. Phase 3 — Dashboard UI

**Goal:** Pixel-faithful port of Sink's analysis page in React.

### 10.1 Route structure

```
src/routes/wp-admin.analytics.tsx              # Layout (date picker + filters + Outlet)
src/routes/wp-admin.analytics._index.tsx       # Overview
src/routes/wp-admin.analytics.realtime.tsx     # Realtime feed
```

### 10.2 Component tree

```
src/ui/admin/analytics/
├── layout/
│   ├── DateRangePicker.tsx       ← Sink: DatePicker.vue / TimePicker.vue
│   ├── Filters.tsx               ← Sink: Filters.vue
│   └── useAnalyticsState.ts      ← URL-synced state hook (replaces Pinia store)
├── overview/
│   ├── Counters.tsx              ← Sink: Counters.vue
│   │   - 3 cards (visits / visitors / referers)
│   │   - @number-flow/react for digit animation
│   │   - Skeleton state with blur-md class until loaded
│   ├── Views.tsx                 ← Sink: Views.vue
│   │   - @unovis/react VisArea + VisLine (>= 2 points)
│   │   - @unovis/react VisGroupedBar (1 point)
│   │   - Auto-pick unit: minute/hour/day from range width
│   │   - ChartCrosshair + tooltip
│   ├── Heatmap.tsx               ← Sink: Heatmap.vue
│   │   - Pure CSS Grid 7×24
│   │   - color-mix(in srgb, var(--chart-1) X%, transparent)
│   │   - Tooltip per cell
│   ├── MetricsGroup.tsx          ← Sink: metrics/Group.vue
│   │   - Tabs over related dimensions
│   │   - 5 invocations:
│   │     - location: country/region/city
│   │     - referer:  referer/slug
│   │     - time:     language/timezone
│   │     - device:   device/deviceType
│   │     - browser:  os/browser/browserType
│   ├── MetricList.tsx            ← Sink: metrics/List.vue
│   │   - Top N list with progress bar
│   │   - Click to push filter
│   └── MetricName.tsx            ← Sink: metrics/name/Index.vue
│       - Renders flag for country / favicon for referer / icon for browser/os
└── realtime/
    ├── LiveChart.tsx             ← Sink: realtime/Chart.vue (chart only)
    ├── LiveLogs.tsx              ← Sink: realtime/Logs.vue
    │   - Scrolling list of latest events
    │   - Each row: flag + country + path + UA badge + relative time
    └── useEventStream.ts         ← EventSource hook
```

### 10.3 State management

Replaces Sink's Pinia store with a React Router-native pattern.

`src/ui/admin/analytics/layout/useAnalyticsState.ts`:
```typescript
import { useSearchParams } from 'react-router'
import { useMemo, useCallback } from 'react'
import { computeDateRange } from '@/shared/analytics/time'

export function useAnalyticsState() {
  const [params, setParams] = useSearchParams()

  const preset = params.get('preset') ?? 'last-7d'
  const time = useMemo(() => {
    const raw = params.get('time')
    if (raw) try { return JSON.parse(raw) } catch {}
    return computeDateRange(preset)
  }, [params])

  const filters = useMemo(() => {
    const raw = params.get('filters')
    if (raw) try { return JSON.parse(raw) } catch {}
    return {}
  }, [params])

  const setPreset = useCallback((p: string) => {
    setParams(prev => {
      prev.set('preset', p)
      prev.delete('time')
      return prev
    })
  }, [setParams])

  const setTimeRange = useCallback((range: [number, number]) => {
    setParams(prev => {
      prev.set('time', JSON.stringify({ startAt: range[0], endAt: range[1] }))
      prev.delete('preset')
      return prev
    })
  }, [setParams])

  const setFilter = useCallback((type: string, value: string) => {
    setParams(prev => {
      const f = { ...filters, [type]: value }
      prev.set('filters', JSON.stringify(f))
      return prev
    })
  }, [filters, setParams])

  const clearFilters = useCallback(() => {
    setParams(prev => { prev.delete('filters'); return prev })
  }, [setParams])

  return { preset, time, filters, setPreset, setTimeRange, setFilter, clearFilters }
}
```

### 10.4 Data fetching

Use React Router's loader + `useFetcher` for refetches:
- Overview page loader: fires all 4 queries (counters / views / heatmap / metrics) in parallel based on `request.url` search params
- On URL change → loader re-runs → components re-render
- For throttle, use `useDebounce` on the search params before calling `setParams`

### 10.5 Visual fidelity checklist

To match Sink's look:
- [ ] CSS variables: `--chart-1`, `--chart-2`, `--foreground`, `--muted-foreground`, `--border`, `--background`
- [ ] Cards with `rounded-xl border bg-card` (Sink uses `Card` from shadcn-vue)
- [ ] `font-bold tabular-nums text-2xl` for counter numbers
- [ ] Skeleton: `opacity-60 blur-md` while loading
- [ ] Tab bar with underline indicator
- [ ] Date preset chips: `last-1h / today / yesterday / last-7d / last-30d / custom`
- [ ] Heatmap cell aspect-ratio: aspect-[4/1] container with `grid-cols-24`
- [ ] Chart aspect-ratio: `aspect-[4/1]`
- [ ] Hover ring: `hover:ring-1 hover:ring-foreground/10`

### 10.6 Tailwind theme adds

If the blog's CSS doesn't already define `--chart-1` / `--chart-2`, add to the global stylesheet:
```css
@theme {
  --color-chart-1: oklch(0.65 0.20 250);  /* indigo-ish */
  --color-chart-2: oklch(0.70 0.15 180);  /* teal-ish */
}
```

---

## 11. Phase 4 — Polish & Extras (Optional)

- [ ] CSV export endpoint (matches Sink's `[action].get.ts`)
- [ ] Per-post drill-down: `wp-admin.analytics.posts.$slug.tsx`
- [ ] Mini-sparkline in admin post list (`wp-admin.posts.tsx`) showing 7-day trend
- [ ] Mmdb auto-refresh cron (e.g. `node-cron` weekly)
- [ ] Audit log: record `(admin_id, ts, viewed_range)` to a `analytics_audit` table whenever the dashboard is opened
- [ ] Rate limit `track` calls per IP per second (paranoia against spam)
- [ ] Materialized view for "top posts last 7d" exposed to public sidebar

---

## 12. Risk / Open Questions

### R1. Drizzle pool client extraction
Need to confirm `db.$client.connect()` returns a `node-postgres` `PoolClient`. If `pool.ts` uses a different client (e.g. `postgres.js` instead of `pg`), `pg-copy-streams` won't work and we'd need a `postgres.js` equivalent — its `sql.unsafe()` + `COPY FROM` differs. **Mitigation**: re-read `src/server/db/pool.ts` at the start of Phase 1.

### R2. RR v7 raw socket access for client IP
Bare Node port → can't trust `X-Forwarded-For` blindly (no proxy → header absent or attacker-controlled). Need to either:
- (a) Pull `request.socket.remoteAddress` via a custom Node entry, or
- (b) Trust whatever upstream populates `X-Real-IP` if/when reverse proxy is added later, with a `TRUSTED_PROXY` env flag

**Mitigation**: implement (a) first via a small `app.use` middleware in `react-router-serve` custom entry; document that adding a proxy later requires flipping the strategy.

### R3. Drizzle migrator and Timescale DDL
Timescale's `create_hypertable()` and policy functions are not idempotent in some versions. Drizzle migrator runs each `.sql` file once based on its journal; **first run is fine** but a re-run on a partial deploy could fail. **Mitigation**: wrap policy calls in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` blocks.

### R4. Compression conflict with CAGs
A continuous aggregate can read from compressed chunks but **cannot refresh into the historical range past the compression threshold without explicit allow** (older TimescaleDB versions). With 7-day compression and CAGs computing only `now() - 24h`, no conflict. Document constraint: never refresh CAGs into > 7-day-old ranges.

### R5. Front-page caching
If/when `react-router-serve` adds CDN/cache headers, SSR loader won't fire on cache hits. **Mitigation**: detect via `Cache-Control: no-cache` on personalized routes; for static-ish routes add a beacon fallback in Phase 5.

### R6. SSE behind possible buffering proxies
None currently, but if Nginx is added later, set `X-Accel-Buffering: no` on SSE responses.

### R7. UV count drift across process restarts
In-memory daily salt → restart resets the salt → previously-hashed visitors become "new" for the rest of the day. For a personal blog this is negligible. **Mitigation**: persist daily salt in Redis (`SET analytics:salt:<date> NX EX 86400`).

### R8. MaxMind ASN db
City db covers country/region/city/lat/lon. If we later want ISP/ASN breakdowns, add `GeoLite2-ASN.mmdb` and corresponding lookups in `enrich.ts`.

---

## 13. File-by-file Change List

### New files
```
docs/blog-analytics-plan.md                       ← this plan
data/maxmind/.gitkeep                              ← placeholder

src/server/analytics/types.ts
src/server/analytics/salt.ts
src/server/analytics/geoip.ts
src/server/analytics/enrich.ts
src/server/analytics/batcher.ts
src/server/analytics/track.ts
src/server/analytics/query.ts

src/routes/api.analytics.counters.tsx
src/routes/api.analytics.views.tsx
src/routes/api.analytics.heatmap.tsx
src/routes/api.analytics.metrics.tsx
src/routes/api.analytics.events.tsx
src/routes/wp-admin.analytics.tsx
src/routes/wp-admin.analytics._index.tsx
src/routes/wp-admin.analytics.realtime.tsx

src/ui/admin/analytics/layout/DateRangePicker.tsx
src/ui/admin/analytics/layout/Filters.tsx
src/ui/admin/analytics/layout/useAnalyticsState.ts
src/ui/admin/analytics/overview/Counters.tsx
src/ui/admin/analytics/overview/Views.tsx
src/ui/admin/analytics/overview/Heatmap.tsx
src/ui/admin/analytics/overview/MetricsGroup.tsx
src/ui/admin/analytics/overview/MetricList.tsx
src/ui/admin/analytics/overview/MetricName.tsx
src/ui/admin/analytics/realtime/LiveChart.tsx
src/ui/admin/analytics/realtime/LiveLogs.tsx
src/ui/admin/analytics/realtime/useEventStream.ts

src/shared/analytics/time.ts                       ← computeDateRange, presets

drizzle/00xx_access_log.sql                        ← Drizzle-generated
drizzle/00xx_access_log_timescale.sql              ← hand-written
```

### Modified files
```
src/server/db/schema.ts          ← append accessLog table
src/routes/routes.ts              ← register new routes (if not auto-discovered)
src/routes/posts.$slug.tsx        ← insert trackAccess() call in loader
src/routes/pages.$slug.tsx        ← same
src/routes/_index.tsx             ← same (homepage)
src/routes/root.tsx               ← session cookie issuance
src/shared/env.ts                 ← add MAXMIND_DB_PATH, ANALYTICS_DISABLE_BOT_LOG
.gitignore                        ← /data/maxmind/*.mmdb
.env.example                      ← new vars
package.json                      ← new deps
```

### Untouched
```
src/server/metrics/batcher.ts    ← keep as-is, bumpPageView still called
src/server/db/schema.ts:metric   ← keep table as-is
front-end post display logic     ← reads from metric.pv as before
```

---

## 14. Acceptance Criteria

Before declaring done:

- [ ] **Smoke**: Visit a post → check `SELECT * FROM access_log ORDER BY ts DESC LIMIT 1` returns the visit
- [ ] **Hypertable**: `SELECT count(*) FROM timescaledb_information.chunks WHERE hypertable_name='access_log'` returns >= 1
- [ ] **Both writes**: A visit increments both `access_log` row count AND `metric.pv` for the post
- [ ] **Bot filter**: Curl with `User-Agent: Googlebot/2.1` does NOT insert into `access_log` (when `ANALYTICS_DISABLE_BOT_LOG=true`)
- [ ] **Auth gate**: `/wp-admin/analytics` redirects to login if unauthenticated
- [ ] **Counters render**: 3 cards show numbers (NumberFlow animation visible on hover/reload)
- [ ] **Views chart**: Area+line renders for ≥ 2 points; bar renders for 1 point
- [ ] **Heatmap**: 7×24 grid renders with at least one colored cell after some visits
- [ ] **Metric tabs**: All 5 groups (location/referer/time/device/browser) show data
- [ ] **Date range**: Switching from "last-7d" to "today" reflows all charts
- [ ] **Filter click**: Clicking a country pushes a filter; all panels narrow accordingly
- [ ] **URL sync**: Copy-paste current URL into a new tab restores identical view
- [ ] **Realtime**: New visit appears in `/wp-admin/analytics/realtime` within 2s
- [ ] **CAG**: After 1h of traffic, `SELECT * FROM stats_hourly` returns non-empty rows
- [ ] **Compression**: After 8 days of traffic, `SELECT * FROM chunk_compression_stats('access_log')` shows compressed chunks
- [ ] **Retention**: Manual `SELECT drop_chunks('access_log', INTERVAL '180 days')` runs without error

---

## 15. Estimated Effort

| Phase | Est. days |
|---|---|
| Phase 0 (infra) | 0.5 |
| Phase 1 (ingestion) | 1.5 |
| Phase 2 (query API) | 1 |
| Phase 3 (UI) | 2.5 |
| Polish / fixes | 0.5 |
| **Total** | **~6 days** |

---

## 16. Execution Notes for Future Self

When picking this up later:

1. **Read this file end-to-end** before touching code. The decisions in §3 are load-bearing.
2. **Start with Phase 0**. Don't begin Phase 1 until `SELECT 1 FROM access_log` works and a manual `INSERT` succeeds.
3. **One PR per phase** if possible, with the acceptance items from §14 verified.
4. **When porting a Vue component**, open both files side by side and translate line-by-line. The `@unovis/react` API is identical to `@unovis/vue`; the main diffs are JSX vs SFC and `:prop=` vs `prop={}`.
5. **If a Sink behavior is unclear**, the source of truth is `/Users/YufanSheng/SourceCode/xiaoyu/Sink/layers/dashboard/app/components/dashboard/analysis/*.vue`.
6. **Don't skip the try/catch around `trackAccess`**. Sink learned this the hard way (`1.redirect.ts:148-152`): an analytics failure must never break the user-facing request.
7. **Resist scope creep**. Globe, A/B, funnels, retention cohorts — all out of scope. The goal is a beautiful dashboard, not Mixpanel.

---

*End of plan. Next action: execute §7 (Phase 0).*
