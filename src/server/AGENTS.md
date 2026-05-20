# Server conventions

`src/server/` is SSR-only. May import from `shared/` and other `server/`.
Must not import from `client/` or `ui/`.

Internal four-layer tree with a strict one-way import graph
(`infra → domains → http`, `domains → render → http`):

```
server/
├── infra/      # Technical primitives — zero business knowledge.
├── domains/    # Self-contained business modules (one folder per domain).
├── http/       # HTTP perimeter (oRPC + Hono).
└── render/     # SSR output products (HTML, RSS/Atom, OG, calendar, avatar, SEO).
```

## infra/

Pure primitives. `db/` (Drizzle pool, schema, migrations,
`operations/<entity>.ts` raw helpers), `redis/` (unstorage + ioredis:
storage, buckets, inflight, `buffer-cache`, `admin-ops`), `http/`
(generic `etag`, `headers`, `status`, `errors` with `DomainError` /
`ActionFailure`), `email/` (sender + React Email), `search/` (openai
client, vector driver), `env.ts`, `logger.ts`, `rate-limit.ts`,
`slug.ts`.

Imports nothing from `domains/`, `http/`, or `render/`.

## domains/

One folder per business domain. Locked vocabulary:
`schema.ts / repo.ts / service.ts / projection.ts / cache.ts` plus
feature-named files (`preview.ts`, `loader.ts`, etc.).

Domains: `analytics`, `auth` (session-storage, csrf, rbac, flows,
verification-tokens), `comments` (loader, moderation, projection, likes,
token, badge, url, canonicalize), `friends`, `images` (schema, service,
storage, key, process), `music`, `pages`, `posts`, `pt`
(Shiki/KaTeX/Mermaid prerender, canonicalize, comment-to-html),
`settings` (sections, snapshot, install-flow, install-gate),
`taxonomies/{categories,tags}`, `users`. Plus `content-revisions.ts`
and `audit.ts`.

Domains may import from `shared/`, `infra/`, and other `domains/`.
`tests/contract.cookie.test.ts` pins `domains/auth/session-storage.ts`.
`src/server/session.ts` is a deprecated barrel preserved for
`vi.mock('@/server/session')`; production code imports `domains/auth/*`
directly.

## http/

HTTP perimeter only. Procedure base (`orpc-base.ts`), context, composed
router (`api-router.ts`), error hook (`errors.ts`), OpenAPI export
(`openapi.ts`), Hono entry (`app.ts`); `middlewares/` (session, csrf,
install-gate, rate-limit, trailing-slash, visitor-cookie, wp-decoy,
hono-rbac); `controllers/` (per-domain `<name>.controller.ts`, admin
under `controllers/admin/`); `resources/` (non-JSON: feed, sitemap,
images, redirects, analytics-events); `loaders/` (React Router data
orchestrators: detail, listing, search, comments, sidebar, pagination,
revalidate, route-exports).

Controllers and loaders **orchestrate only** — business logic stays in
`domains/<x>/service.ts`.

### Base procedures

Built off `os.$context<HandlerContext>()`. Each chains its own auth/role
middleware; the leaf procedure picks one and inherits the guard.

| Base         | Guard                                 | Use for                    |
| ------------ | ------------------------------------- | -------------------------- |
| `publicProc` | No auth gate; `csrfGuard` on non-GET  | Anonymous + CSRF mutations |
| `authedProc` | `requireAuth` + `csrfGuard`           | Any logged-in user         |
| `authorProc` | `requireRole('author')` + `csrfGuard` | Authors and admins         |
| `adminProc`  | `requireRole('admin')` + `csrfGuard`  | Admins only                |

### Controllers

Shape: `procBase.input(zod).output(zod).handler(({input, context}) => …)`,
exported on the file's `<domain>Router`. Handlers orchestrate only;
business logic stays in `server/domains/<x>/service.ts`.

**Adding an endpoint**: (1) shared schema → `shared/contracts/<domain>.ts`
with a parity assertion, OR inline `z.object({...})` next to the
procedure; (2) append a procedure to the matching controller, picking
the right base; (3) controller already wired in `api-router.ts`?
done — else add one line under `apiRouter` or `apiRouter.admin`.

### Router and mount

`server/http/api-router.ts` groups per-domain routers into `apiRouter`
(`ApiRouter`). The `admin: {…}` sub-tree mirrors the URL hierarchy.
Mount: one `RPCHandler` at `/rpc/*` with `csrfGuard` upstream — handlers
never call `validateRequestCsrf` themselves. Per-procedure response
headers ride through a mutable `responseHeaders: Headers` on the context
and are merged onto the final `Response`.

**Resource routers** (`server/http/resources/`) are native Hono for
non-JSON output. RBAC via
`server/http/middlewares/hono-rbac.ts::requireRoleMw`.

**OpenAPI** at `/openapi.json` + `/docs`, auto-generated from `apiRouter`
in development.

**Audit permissions** with one grep:
`grep -rn "adminProc\|authorProc\|authedProc\|publicProc" src/server/http/controllers/`.
Smoke coverage in `tests/server.http.orpc-smoke.test.ts`.

### Hono / oRPC rules

- No business logic inside procedure handlers.
- Throw `ORPCError('CODE', { message })` from procedures or services.
  `onErrorHandler` (`server/http/errors.ts`) handles the rest.
  Service layers do not throw `HTTPException`.
- Do not bypass `apiRouter` with ad-hoc Hono RPC routes. Non-JSON
  resource routes belong in `server/http/resources/`.
- Procedure inputs are a single flat object — no
  `{ body, query, params }` buckets.
- Use `.output(z.void())` for 204-like procedures.

## render/

SSR output products. `seo/`, `feed/` (RSS/Atom + PT-feed renderer),
`og/`, `calendar/` (SVG + Hono serve helper), `avatar/` (Gravatar/QQ
fetcher + Redis cache), `react-prerender.ts`, `image-enhance.ts` (feed
HTML post-processor), `image-compress.ts` (shared PNG helper).

Never persists — produces strings, Buffers, or Responses. Caching is
the caller's responsibility.

## Sessions, Env, Security

- Sessions: Hono middleware (`server/http/middlewares/session.ts`)
  wraps React Router `createSessionStorage` with Redis persistence and
  a signed `__session` cookie. `SESSION_SECRET` required. Populates
  `c.var.session` and commits `Set-Cookie` after the response.
- Server env: `@/server/infra/env` (`@t3-oss/env-core` + Zod). Adding
  an env var updates the schema, `src/env.d.ts`, and `.env.example`
  together.
- The S3 toggle (`assets.storage.enabled`), credentials, bucket, asset
  CDN host, and upload limits live under `setting('blog.assets')`,
  edited at `/admin/settings/assets`. No `ASSET_HOST` /
  `ASSET_SCHEME` env vars; `assets.asset.host` / `assets.asset.scheme`
  is the same CDN host used by the image library and `<MusicPlayer>`.
- CSRF: `@/server/domains/auth/csrf`. Client-address parsing:
  `@/shared/utils/request` + `@/shared/utils/security`. Use `zod`
  directly.

## Configuration & Install Gate

- Source of truth is the `setting` table — one JSONB row per section,
  `scope='blog.<section>'`. 14 sections: `general`, `assets`,
  `navigation`, `socials`, `content`, `sidebar`, `comments`, `seo`,
  `footer`, `mail`, `cache`, `rateLimit`, `search`, `fonts`.
  Per-section splitting avoids races between concurrent admin tabs.
- Section ↔ DB scope ↔ Zod schema ↔ bundle key mapping lives in
  `@/server/domains/settings/sections.ts`'s `SECTION_REGISTRY`.
- In-memory composition: `BlogSettingsBundle` (`@/shared/config/blog`).
  SSR uses `requireBlogSettingsSection('<key>')`; UI uses the matching
  per-section hook. **New UI MUST NOT** read the aggregated
  `useBlogSettingsBundle()` — reading a slice you don't need re-renders
  on every unrelated section save.
- Install flow is two stages, gated by admin login:
  1. `routes/auth/setup/index.tsx` (`/admin/setup`) creates
     the first admin row and auto-logs in. Redirects to stage 2.
  2. `routes/auth/setup/settings.tsx`
     (`/admin/setup/settings`) persists `blog.general` and
     `blog.assets` from the form AND seeds the remaining 12 sections
     from `SECTION_REGISTRY[<section>].defaults`. All 14 rows are
     written atomically. `blog.assets` defaults to upload toggle OFF.
- `honoInstallGateMiddleware`
  (`@/server/http/middlewares/install-gate.ts`) reads
  `getInstallState()` and routes: no admin → `/admin/setup`;
  installed → through. Static assets, framework internals, and the
  install/login pair are exempt via `ensureInstalledOrRedirect()` /
  `ensureNoAdminOrRedirect()`. After the one-step install migration,
  "has admin" is equivalent to "installed" — there is no intermediate
  state.
- Pre-existing deployments missing optional sections are backfilled
  lazily by `loadSettingsFromDb()` + `upsertSetting`. Best-effort,
  swallows DB errors.
- Admin saves go through `api.admin.settings.update` (oRPC), which
  validates against `SECTION_REGISTRY[section].schema` and writes ONLY
  that one row. No aggregate "reset to defaults" action.

## Content

### Posts and pages

- `post` + `content` → `/posts/:slug`. `page` + `content` → `/:slug`.
  Both rendered via `<PortableTextBody>`. Public URLs use `slug`, not
  internal id.
- Custom block components in `@/ui/pt/blocks/`.
- `visible=false` posts are hidden from the public home and random-post
  widgets but stay in `/archives`, `/tags/:slug`, `/search/:keyword`,
  `sitemap.xml`, feeds, and category/tag listings and counts.
  Future-dated posts stay excluded until publish time.
- **Post default cover image.** Both `toCmsPost` (detail page) and
  `toClientPostFromMeta` (listings) must fall back to
  `/images/open-graph.png` when `meta.cover` is empty. Any new
  projection function that produces a public `cover` field MUST
  replicate this fallback and be covered by a unit test in
  `tests/service.cms-posts-projection.test.ts`.
- **Draft post visibility gate.** A post is considered draft (invisible
  to the public) when `published=false` OR `publishedRevisionId=null`.
  The admin lifecycle filter treats both cases as draft; all public
  queries (`buildPublicPostsWhere`, `isCatalogVisible`, `findPostBySlug`)
  MUST check both conditions. A post with `published=true` but no
  published revision must NOT appear on the home page, in listings,
  feeds, or sitemap.

### Taxonomies (categories, tags, friends)

- Postgres tables edited from `/admin/{categories,tags,friends}`.
  Deletion is blocked while a post still references the row.

### Slug derivation and uniqueness

- Canonical helper: `@/server/infra/slug::deriveSlug(text)`. Pipeline
  `pinyin-pro` → whitespace-collapse → `github-slugger`, post-pass
  satisfies `SLUG_PATTERN` (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
- Server-only — `pinyin-pro` ships ~150KB of CJK lookup tables and must
  NOT reach the client. Admin forms send `slug?: string`; the service
  derives from the entity name/title when blank.
- All authoring surfaces (tag, category, page, heading-anchor) flow
  through `deriveSlug`. Page schema permits `[._-]` in user-supplied
  slugs so legacy URLs like `archives.html` survive; the derived value
  is always plain kebab-case ASCII.
- Heading anchors for DB-backed pages: SSR loaders pre-compute
  `collectHeadings(body, deriveSlug).map(h => h.slug)` and pass it to
  `<PortableTextBody headingSlugs>`. The renderer consumes one slug per
  heading via a per-render cursor; without the prop it falls back to a
  local `github-slugger`.
- **Page ↔ post slugs share one namespace.** Catalog, OG generator,
  comment threading, and sitemap key on slug alone. Enforcement is
  split: DB `UNIQUE(slug)` on `page` catches page↔page; the cross-table
  fence lives in
  `@/server/domains/pages/fence::validateSlugFence`, available for
  cold-start slug fence validation. New slug emitters MUST fold into
  `validateSlugFence`.

### Images

- Postgres `image` table; bytes in S3. Public URL is
  `<storage.publicBaseUrl>/<storagePath>`.
- `@/server/domains/images/storage` is gated on `assets.storage.enabled`
  in `setting('blog.assets')`. ON → PUT/DELETE through
  `@/server/infra/storage/s3-client`. OFF (default for fresh installs)
  → PUT/DELETE return `ActionFailure(503)`; the SSR enhancer still
  resolves historical rows against the saved `publicBaseUrl`. Toggling
  back on does not require re-pasting credentials.
- Every `image` row is an S3 object — no `external` origin, no
  `image.source` discriminator.
- Uploads go through `/admin/library/images` (generic
  `images/yyyy/MM/<timestamp>.jpg`), plus inline upload in
  `EditCategoryDialog` (`images/categories/<slug>.jpg`) and
  `EditFriendDialog` (`images/links/<host>.jpg`), both 1280×425.
- `@/server/render/image-enhance` post-processes generated HTML for
  feeds and synchronously resolves cover thumbhashes via a process-level
  LRU cache.

### Music

- Postgres `music` table; audio (`musics/<playerId>.mp3`) and 300×300
  JPEG covers (`musics/<playerId>.jpg`) in the same S3 bucket, gated on
  `assets.storage.enabled`.
- PortableText references rows via a 16-char lowercase nanoid. Service
  is `@meting/core` netease-only; `(source, sourceId)` is unique with
  `source` reserved as varchar for future providers. Lyrics live in
  `music.lyric` so the player avoids a second round trip.

## Server layering constraints

- `infra/*` imports nothing from `domains/`, `http/`, or `render/`.
- `domains/*` modules use the locked
  `schema.ts / repo.ts / service.ts / projection.ts / cache.ts`
  vocabulary. Do not reintroduce `repository.ts` + `query.ts`
  coexistence. Do not split a domain's schema, queries, or cache into
  `infra/` (`infra/db/operations/` is the only exception — raw
  Drizzle helpers shared across domains).
- `http/controllers/*` and `http/loaders/*` orchestrate only.
  Admin procedures live under `controllers/admin/` and mount at
  `apiRouter.admin.<name>`.
- `render/*` produces strings / Buffers / Responses and never
  persists. Caching is the caller's responsibility.
- No barrel `index.ts` files anywhere inside `server/`.
