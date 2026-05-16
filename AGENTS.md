# AGENTS.md

Repository conventions for AI agents and contributors. Read this before
authoring routes, content loaders, templates, React components, or server
code.

`CLAUDE.md` is a `git`-tracked symlink to this file. Edit only `AGENTS.md`.

## Skills Are the Baseline

Conventions below are calibrated against the agent Skills under
`.claude/skills/` and `.agents/skills/`, kept in sync via
`skills-lock.json`. Open SKILL.md and any referenced rule files _before_
writing code when a task triggers one of these:

| Skill                         | Triggers                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `react-router-framework-mode` | Routes, loaders, actions, forms, navigation, error boundaries, `react-router.config.ts`. |
| `vercel-react-best-practices` | Any React/SSR code. The 70 numbered rules are the performance baseline.                  |
| `vercel-composition-patterns` | New components, boolean-prop matrices, compound components, context providers.           |
| `shadcn`                      | shadcn/ui components, presets, `components.json`.                                        |
| `tailwind-design-system`      | CSS tokens, design-system primitives, Tailwind v4 `@theme` changes.                      |
| `web-design-guidelines`       | UI accessibility, UX, Web Interface Guidelines compliance.                               |

Skills win on conflict. Quote stable rule ids in PR review (e.g.
`bundle-barrel-imports`, `architecture-avoid-boolean-props`,
`server-no-shared-module-state`). Out-of-scope topics fall back to this
document and upstream library docs.

## Stack

- React Router 7 Framework Mode with SSR. `react-router.config.ts` keeps
  `appDirectory` at `src` and enables `future.v8_middleware`.
- Vite (via Vite+) builds; `vite.config.ts` wires React Router, binary
  assets, path aliases, and dev server.
- React 19 TSX/TS only.
- Postgres for users, comments, likes, counters, settings, taxonomies,
  posts, pages, images, music. Redis for sessions, rate limits, avatars,
  and generated-image caches.
- Posts and pages live in Postgres (`post`/`page` + `content`) and are
  edited at `/wp-admin/{posts,pages,categories,tags,friends,images,musics}`.

## Architecture

Four cooperating layers under `src/` with a one-way import graph:

```
src/
├── routes/      # Loader / action / meta / component orchestration.
├── server/      # SSR-only logic. DB, Redis, session, mail, cache, services.
├── client/      # Browser-side logic. Hooks, fetchers, browser APIs.
├── ui/          # Pure-props React components.
├── shared/      # Isomorphic, side-effect-free modules.
├── assets/      # Static assets (icon SVGs, fonts, styles).
├── env.d.ts
├── react-router.d.ts
├── routes.ts    # Route manifest (URL → route module).
├── root.tsx     # Document shell.
└── server.ts    # Hono entry / SSR adapter.
```

### `src/routes/` — Orchestration Only

- `*.tsx` page route modules (`loader` / `action` / `meta` / default
  component). `*.ts` resource routes are rare — most non-page output is
  served by Hono (see API Layer).
- Read session/context at the perimeter, call into `server/`, project
  DTOs through `shared/`, render with `ui/`. No DB queries, Redis access,
  or markdown parsing inline.
- Public URLs and physical paths stay stable — React Router derives
  route ids from the file path.

### `src/server/` — SSR Only

May import from `shared/` and other `server/`. Must not import from
`client/` or `ui/`. The tree is four cooperating layers with a strict
one-way import graph:

```
server/
├── infra/      # Technical primitives — zero business knowledge.
├── domains/    # Self-contained business modules (one folder per domain).
├── http/       # HTTP perimeter (oRPC + Hono): middlewares, controllers, loaders, resources.
└── render/     # SSR output products (HTML, RSS/Atom, OG, calendar, avatar, SEO).
```

- **`server/infra/`** — Pure technical primitives. `db/` (Drizzle
  pool, schema, migrations, `operations/<entity>.ts` raw query
  helpers, types, target), `redis/` (unstorage + ioredis: storage,
  buckets, inflight, `buffer-cache.ts`, `admin-ops.ts`), `http/`
  (`etag`, `headers`, `status`, `errors` — generic HTTP vocabulary
  including `DomainError` / `ActionFailure`), `email/` (sender +
  React Email templates), `search/` (openai client, vector driver,
  options), `env.ts` (`@t3-oss/env-core` + Zod), `logger.ts`,
  `rate-limit.ts`, `slug.ts`. Imports nothing from `domains/`,
  `http/`, or `render/`.
- **`server/domains/`** — One folder per business domain. Each domain
  uses the locked vocabulary `schema.ts / repo.ts / service.ts /
projection.ts / cache.ts` plus feature-named modules (e.g.
  `preview.ts`, `loader.ts`, `token.ts`). Current domains: `analytics/`,
  `auth/` (session-storage, csrf, rbac, flows, verification-tokens,
  primitives, context), `catalog/` (build, snapshot, queries, fence,
  invalidate), `comments/` (loader, moderation, projection, likes,
  token, badge, url, canonicalize), `content-revisions.ts` (shared
  content row repo used by posts + pages), `friends/`, `images/`
  (schema, service, s3-client, storage, key, process), `music/`,
  `pages/` (schema, repo, service, projection, preview, loader,
  image-sync), `posts/` (schema, repo, service, projection, preview,
  indexer, reindex), `pt/` (Shiki/KaTeX/Mermaid
  prerender, canonicalize, comment-to-html), `settings/` (schema,
  service, projection, sections, snapshot, timezones, install-flow,
  install-gate), `taxonomies/` (`categories/{schema,service}.ts`,
  `tags/{schema,service}.ts`, `shared.ts`), `users/`. Domains may
  import from `shared/`, `infra/`, and other `domains/`.
  `tests/contract.cookie.test.ts` pins the path
  `src/server/domains/auth/session-storage.ts` — keep it stable.
  `src/server/session.ts` is a deprecated barrel preserved for
  test mocks (`vi.mock('@/server/session')`); production code
  imports directly from `domains/auth/*`.
- **`server/http/`** — HTTP perimeter only. Procedure base factory
  (`orpc-base.ts`), context (`context.ts`), composed router
  (`api-router.ts`), error hook (`errors.ts`), OpenAPI export
  (`openapi.ts`), Hono entry (`app.ts`); `middlewares/` (session, csrf,
  install-gate, rate-limit, trailing-slash, visitor-cookie, wp-decoy,
  hono-rbac); `controllers/` (per-domain `<name>.controller.ts` for
  public/authed/author surfaces, plus `controllers/admin/` for the
  admin sub-tree); `resources/` for non-JSON output (feed, sitemap,
  images, redirects, analytics-events); `loaders/` for React Router
  data orchestration (detail, listing, search, comments, sidebar,
  pagination, revalidate, route-exports). Controllers **orchestrate
  only** — business logic stays in `domains/<x>/service.ts`.
- **`server/render/`** — SSR output products. `seo/` (meta builders,
  sitemap), `feed/` (RSS/Atom generator and PT-feed renderer), `og/`
  (OG image renderer and font/logo assets), `calendar/` (SVG renderer
  and Hono `serve` helper), `avatar/` (Gravatar/QQ fetcher and Redis
  cache), `react-prerender.ts` (`prerenderToHtml` drain),
  `image-enhance.ts` (HTML post-processor for feeds),
  `image-compress.ts` (PNG output helper shared by og/calendar/avatar).
  Never persists — produces strings, Buffers, or Responses for the
  caller to ship.

### `src/client/` — Browser Only

- Hooks (`hooks/`) and the oRPC client (`api/`). All HTTP calls go
  through `api.<domain>.<endpoint>(flatInput)` from
  `@/client/api/client`. The typed client is built from
  `typeof apiRouter`. `unwrap()` translates oRPC `ORPCError` rejections
  into the existing `ApiError` class. TanStack Query wrappers live in
  `@/client/api/orpc-query` and `@/client/api/query`.
- Heavy widgets (e.g. `qrcode.react`) reach the bundle through
  React.lazy + Suspense from a UI component, not top-level imports
  (`bundle-dynamic-imports`).
- May import from `shared/` and other `client/`. Must not import any
  `server/` module or Node-only API.

### `src/ui/` — Pure-Props Components

Components receive explicit props. No reads from sessions, route params,
request objects, or environment variables. State lives at the route
module or the closest interactive parent. Three tiers:

- **`ui/components/`** — shadcn/ui primitives (Base UI variant), flat
  so `npx shadcn@latest add/diff` works (`components.json` aliases
  `components` and `ui` here). Public + admin both consume directly;
  one token cascade in `:root` (`tailwind.css`) covers both.
- **`ui/public/`** — `chrome/`, `post/`, `comments/`, `widgets/`, plus
  single-file leaves (`Search.tsx`, `Sidebar.tsx`, `LikeActions.tsx`).
- **`ui/admin/`** — grouped by domain (`analytics/`, `auth/`,
  `categories/`, `comments/`, `editor/`, `friends/`, `images/`,
  `musics/`, `my/`, `pages/`, `posts/`, `sessions/`, `settings/`,
  `tags/`, `users/`, `welcome/`, `shared/`, `shell/`).

Cross-cutting at the top of `ui/`:

- `ui/pt/` — PortableText SSR renderer (`render.tsx`,
  `Footnotes.tsx`, `image-meta-context.tsx`) and custom-block React
  components under `ui/pt/blocks/` (CodeBlock, BlockImage,
  MusicPlayer, Solution, Friends).
- `ui/icons/` — Static-export icon library. Use named imports; never
  `<Icon name="..." />` string lookups.
- `ui/lib/` — UI-only utilities (`cn`, `code-languages`,
  `ThemeProvider`, `blog-config-context`, `use-media-query`). shadcn's
  `aliases.lib` is pinned here. No `src/lib/` parallel.

Rules:

- For raw HTML, use `dangerouslySetInnerHTML` on the host element — no
  generic `Html` wrapper.
- Use `cn()` from `@/ui/lib/cn` for conditional classNames. It composes
  `clsx` with a project-customised `tailwind-merge` that registers every
  `@theme` token. Adding a new `--<namespace>-<name>` token in
  `tailwind.css` MUST be paired with an entry in `cn.ts`'s per-namespace
  list — enforced by `tests/contract.tailwind-tokens.test.ts`.
- Use `<Image />` from `@/ui/public/widgets/Image` for transformed
  remote images.

### `src/shared/` — Isomorphic Only

Side-effect-free, safe in both bundles. Forbidden: `node:*`, `ioredis`,
`drizzle-orm`, DOM-only APIs (`window`, `document`), direct
`process.env`. Groupings:

- `config/` — `blog`, `settings`, `socials` (BlogSettingsBundle).
- `contracts/` — Zod schemas (the wire format).
- `types/` — DTO interfaces (parity-checked against `contracts/`).
- `pt/` — PortableText schema, bridge, semantics, comment markdown,
  footnote-merge.
- `utils/` — `urls`, `safe-url`, `request`, `security`, `tools`,
  `formatter`, `pagination`, `toc`, `paths`, `roles`, `user-agent`,
  `chunk-error`, `comment-token`, `footnotes-section-title`.

## Path Aliases

- `@/*` → `./src/*`. No `~/*` alias.
- Files under `public/` are served as-is at the root URL — reference by
  absolute URL in JSX/config, not by TS import.

Use aliases instead of relative paths. Allowed relative imports:

- `src/routes.ts` → project code (must use `./...` because React Router
  reads the manifest before Vite resolves aliases).
- `./+types/*` — React Router type codegen colocated with each route.
- `vite.config.ts` and config-only plugins use explicit `.ts`
  specifiers (Vite+'s ESM config loader needs them;
  `allowImportingTsExtensions` is enabled for this).

## Routing And Data

- React Router `loader` for render-time data, `action` for route form
  submissions. Use `redirect`, `data`, `Response`, and thrown responses
  for control flow.
- Keep auth and session reads in loaders/actions. UI receives plain DTOs.
- **Non-page requests** (API, feeds, sitemap, generated images) are
  served by Hono native routes mounted in `server.ts`, NOT React Router
  resource routes.

## Content

### Posts and pages (Postgres)

- `post` + `content` rendered at `/posts/:slug` via `<PortableTextBody>`.
- `page` + `content` rendered at `/:slug` via `<PortableTextBody>`.
- Frontmatter equivalents (slug, categories/tags, visibility flags) live
  in their tables. Public URLs use `slug`, not internal id.
- `@/server/domains/catalog` serves compiled body, headings, raw source, and
  listing fields. Custom block components live under `@/ui/pt/blocks/`.

### Listing rules

- `visible=false` posts are hidden from the public home and random-post
  widgets but stay in `/archives`, `/tags/:slug`, `/search/:keyword`,
  `sitemap.xml`, feeds, and category/tag listings and counts. Future-dated
  posts stay excluded until publish time.

### Taxonomies (categories, tags, friends)

- Postgres tables edited from `/wp-admin/{categories,tags,friends}`.
- Deletion is blocked while a post still references the row.

### Slug derivation

- One canonical helper: `@/server/infra/slug::deriveSlug(text)`. Pipeline
  is `pinyin-pro` → whitespace-collapse → `github-slugger`, with a
  post-pass that always satisfies `SLUG_PATTERN`
  (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
- Server-only — `pinyin-pro` ships ~150KB of CJK lookup tables and must
  NOT reach the client bundle. Admin forms send `slug?: string` and the
  service derives from the entity name/title when blank.
- All authoring surfaces (tag, category, page, heading-anchor) flow
  through `deriveSlug`. Page schema permits `[._-]` in user-supplied
  slugs so legacy URLs like `archives.html` survive; the derived value
  is always plain kebab-case ASCII.
- Heading anchors for DB-backed pages: SSR loaders pre-compute
  `collectHeadings(body, deriveSlug).map(h => h.slug)` and pass the list
  to `<PortableTextBody headingSlugs>`. The renderer consumes one slug
  per heading via a per-render cursor; without the prop it falls back to
  a local `github-slugger`.

### Slug uniqueness — page ↔ post is global

- Page slugs and post slugs share a single namespace. Even though public
  routes physically separate them (`/posts/:slug` vs `/:slug`), the
  catalog, OG image generator, comment threading, and sitemap all key on
  slug alone. A page slug equal to a post slug (or any post `alias[]`)
  is a violation.
- Enforcement is split: DB `UNIQUE(slug)` on `page` catches page↔page;
  the cross-table page↔post fence lives in
  `@/server/domains/catalog/fence::validatePageSlugs`, run at catalog cold
  start and after every admin save. A colliding save succeeds at save
  time and surfaces as a 500 on the next catalog rebuild — keep this
  asymmetry in mind.
- Adding a new slug emitter MUST be folded into `postSlugs` or
  `validatePageSlugs`.

### Page draft preview

- `routes/page.detail.tsx` paints a red admin-only badge via
  `PageDetailBody`'s `draftMarker` prop. Catalog miss
  (`page.published=false`, scheduled, never published) → anonymous 404,
  admin sees latest draft with **【草稿】**. Catalog hit + `?draft=true` →
  anonymous ignores, admin sees draft overlay with
  **【未发布的草稿】** (newer draft exists) or **【已发布的草稿】**
  (latest revision IS published).
- Marker discriminator is
  `'draft' | 'unpublished-draft' | 'published-draft' | null` in
  `@/ui/public/post/PageDetailBody`. Service is
  `loadPageDraftPreviewBySlug` returning `{ page, hasNewerDraft }`.

### Page meta toggles

- `page` carries operator-facing booleans (`comments_enabled`,
  `show_toc`, `show_friends`) edited from `MetaSidebar` and consumed by
  `routes/page.detail.tsx` as render-time branches — never body
  mutations.
- `show_friends` appends the global friends grid below the body before
  the Like button. PortableText has no `friends` block; this toggle is
  the only way to surface the grid.
- Adding a toggle touches: db schema + migration + snapshot, page
  projection, page service + schema, shared DTOs + catalog type,
  `MetaSidebar` + `PageEditorShell`, and the `CreateDraftMeta` mirror
  in `@/client/hooks/use-create-page-draft`. Test fixtures in
  `tests/_helpers/catalog.ts` + `tests/service.cms-pages*.test.ts` need
  the new default.

### Images

- Postgres `image` table; bytes in an S3-compatible bucket. Public URL
  is `<storage.publicBaseUrl>/<storagePath>`.
- `@/server/domains/images/storage` is gated on `assets.storage.enabled` in
  `setting('blog.assets')`. ON → PUT/DELETE through
  `@/server/domains/images/s3-client`. OFF (default for fresh installs) →
  PUT/DELETE return `ActionFailure(503)`; the SSR enhancer still
  resolves historical rows against the saved `publicBaseUrl`. Toggling
  back on does not require re-pasting credentials.
- Every `image` row is an S3 object — no `external` origin, no
  `image.source` discriminator.
- Uploads go through `/wp-admin/images` (generic
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

### PortableText editor

- Body is PortableText (PT). Zod dialect: `@/shared/pt/schema` (text /
  list / heading / blockquote + custom blocks `image`, `code`,
  `mathBlock`, `mermaid`, `horizontalRule`, `musicPlayer`, `solution`,
  `footnoteDefinition`, `table`). Friends grid is NOT a body block — it's
  a `page.show_friends` toggle.
- Server-only PT helpers in `@/server/domains/pt/*` (prerender, canonicalize)
  must never reach the client bundle.
- PT ↔ ProseMirror bridge is `@/shared/pt/bridge` — single file. Custom
  blocks ride a generic `blockCard` PM node. Round-trip is
  contract-tested in `tests/contract.pt-bridge.test.ts`.
- SSR renderer is `@/ui/pt/render` (`PortableTextBody`), composing
  `@portabletext/react` with `@/ui/pt/blocks/*`. Heading anchor ids
  align with post anchors.
- Admin editor is `@/ui/admin/editor/PageBodyEditor` (shared by pages
  and posts). UX in three layers:
  1. Toolbar (in `PageBodyEditor.tsx`) — image library, music picker,
     link, table, hr, undo/redo.
  2. `tiptap/BubbleMenu` (text selection: B/I/U + code + link popover +
     `mathInline`/`footnoteRef` panels) and `tiptap/TableBubbleMenu`
     (table selection). Mutually exclusive — `BubbleMenu.shouldShow`
     hides inside tables.
  3. `tiptap/SlashMenu` — `@tiptap/suggestion` launcher. Catalogue in
     `tiptap/slash-commands.ts`; pickers dispatch `CustomEvent`s from
     `tiptap/editor-events.ts`.
- Image block uses a React NodeView (`tiptap/ImageNodeView`) for inline
  alt + caption edits.
- **Table dialect**: cells are inline-only — no nested blocks, lists,
  code blocks, math blocks, or footnote refs. Only `link` mark-defs.
  Slash-menu / toolbar inserts a 3×3 table with a header row.
- Floating popups anchor with `position: fixed` driven off the
  suggestion plugin's `clientRect` or Tiptap's built-in `BubbleMenu`
  positioner. Do **not** add `@floating-ui/*` directly — `@base-ui/react`
  already pulls it in transitively.

## RSC Layering Rules

- `server/*` may import from `shared/*` and other `server/*`. May not
  import from `client/*` or `ui/*`.
- `client/*` and `ui/*` may import from `shared/*`, `ui/*`, `client/*`.
  May not import any `server/*` module or `.server.*` file.
- `shared/*` may import from `shared/*` only. Runs in both bundles
  without polyfills.
- `routes/*` may import from any layer. Components rendered by a route
  must accept plain props and must not reach back into `server/*` inside
  the JSX tree.
- The `*.server.ts` suffix is redundant inside `src/server/` and
  required for any module outside `src/server/` that must never reach
  the client (none should remain by design).
- Avoid barrel files (`bundle-barrel-imports`).

Skill rules reviewers cite during PR review:
`server-no-shared-module-state`, `server-cache-react`,
`bundle-analyzable-paths`, `bundle-dynamic-imports`,
`rendering-resource-hints`, `rerender-memo`.

## Component Rules

- Plain TSX with explicit props. No hidden reads from route params,
  sessions, request objects, or env vars.
- Compose with children and slots, not boolean prop matrices
  (`architecture-avoid-boolean-props`).
- Prefer compound components over render-prop callbacks.
- Recursive components recurse by component name.
- React 19: no `forwardRef` for new components; refs flow through props.

## Client Interactivity

- All interactivity lives in components/hooks under `@/client/` and
  `@/ui/`. There is no separate browser-script pipeline —
  `src/assets/scripts` is intentionally absent.
- Interactive components call resource URLs through the oRPC client
  (`api` from `@/client/api/client`). They must not import server
  modules (a type-only import for `RouterClient<ApiRouter>` typing is
  the one allowed exception — `import type` erases at compile time).
- Avoid adding new client dependencies unless the interaction needs them.

### iOS auto-zoom contract

iOS Safari zooms in when focusing a form control with `font-size < 16px`.
Instead of a typographic floor (which would break density), every form
control inherits an app-wide hook that disables user-scaling on the
viewport `<meta>` while any control is focused.

- Single source: `useIosNoZoomOnFocus()` in
  `@/client/hooks/use-ios-no-zoom`, mounted **once** at the top of
  `src/root.tsx`'s `App`. Document-level `focusin`/`focusout` covers
  every `INPUT`/`TEXTAREA`/`SELECT` on every page.
- Do NOT re-install per-form — two listeners would race the same
  `<meta>` rewrite.
- Gated to iOS/iPadOS WebKit; other platforms no-op.
- Focus traversal keeps the lock; the meta value restores only when
  focus leaves form-control DOM entirely.

## Sessions, Env, And Security

- Sessions use Hono middleware (`server/http/middlewares/session.ts`)
  wrapping React Router `createSessionStorage` with Redis persistence
  and a signed `__session` cookie. `SESSION_SECRET` required. The
  middleware populates `c.var.session` and commits `Set-Cookie` after
  the response is built.
- Server env access goes through `@/server/infra/env` (built on
  `@t3-oss/env-core` + Zod). When adding env vars, update the schema,
  `src/env.d.ts`, and `.env.example` together.
- The S3 toggle (`assets.storage.enabled`), credentials, bucket, asset
  CDN host, and upload limits live under `setting('blog.assets')`,
  edited at `/wp-admin/settings/assets`. No `ASSET_HOST`/`ASSET_SCHEME`
  env vars; `assets.asset.host`/`assets.asset.scheme` is the same CDN
  host used by the image library and `<MusicPlayer>`.
- Use `zod` directly. CSRF lives in `@/server/domains/auth/csrf`; client-address
  parsing in `@/shared/utils/request` and `@/shared/utils/security`.

## Configuration & Install Gate

- Source of truth for runtime blog config is the `setting` table — one
  JSONB row per section, `scope='blog.<section>'` (`general`, `assets`,
  `navigation`, `socials`, `content`, `sidebar`, `comments`, `seo`,
  `footer`, `mail`, `cache`). Per-section splitting avoids race between
  concurrent admin tabs.
- Section ↔ DB scope ↔ Zod schema ↔ bundle key mapping lives in
  `@/server/domains/settings/sections.ts`'s `SECTION_REGISTRY`.
- In-memory composition: `BlogSettingsBundle` (`@/shared/config/blog`).
  SSR uses `requireBlogSettingsSection('<key>')`; UI uses the matching
  per-section hook (`useSiteIdentity`, `useAssetsSettings`,
  `useNavigationSettings`, …). Each hook has strict (throws) and
  `…Optional` variants.
- **New UI components MUST NOT** read the aggregated
  `useBlogSettingsBundle()`. Reading a slice you do not need re-renders
  on every unrelated section save. Use the per-section hook.
- Install flow is two stages, gated by admin login:
  1. `/wp-admin/install.php` creates the first admin row and auto-logs
     in. Redirects to stage 2.
  2. `/wp-admin/install/settings.php` persists `blog.general` and
     `blog.assets` from the form AND seeds the remaining 9 sections from
     `SECTION_REGISTRY[<section>].defaults`. 11 rows atomic. `blog.assets`
     defaults to upload toggle OFF.
- `honoInstallGateMiddleware`
  (`@/server/http/middlewares/install-gate.ts`) reads `getInstallState()`
  and routes: no admin row → `/wp-admin/install.php`; admin present but
  settings missing → `/wp-admin/install/settings.php`; installed →
  through. Static assets, framework internals (`/__manifest`, …), and
  the install/login trio are exempt via
  `ensureInstalledOrRedirect()` / `ensureNoAdminOrRedirect()` /
  `ensureNoSettingsOrRedirect()` — exactly one helper throws per state.
- Pre-existing deployments missing optional sections are backfilled
  lazily by `loadSettingsFromDb()` + `upsertSetting`. Best-effort,
  swallows DB errors.
- Admin saves go through `api.admin.settings.update` (oRPC), which
  validates against `SECTION_REGISTRY[section].schema` and writes ONLY
  that one row. There is no aggregate "reset to defaults" action.

## API Layer (Hono + oRPC)

- **Base procedures** (`server/http/orpc-base.ts`) built off
  `os.$context<HandlerContext>()`: `publicProc`, `authedProc`,
  `authorProc`, `adminProc`. Each chains its own auth/role middleware;
  the leaf procedure picks one and inherits the guard.
- **Procedures live alongside controllers**
  (`server/http/controllers/<domain>.controller.ts`, admin under
  `controllers/admin/`). Each procedure is
  `procBase.input(zod).output(zod).handler(({input, context}) => …)`,
  exported on the file's `<domain>Router`. Business logic lives in
  service modules (`server/<domain>/service.ts`); handlers orchestrate.
- **Zod DTOs** in `shared/contracts/` are paired with compile-time
  `Equals<z.infer, TInterface>` parity assertions against
  `src/shared/types/*.ts`. Drift becomes a build error.
- **Composition** (`server/http/api-router.ts`) groups per-domain
  routers into `apiRouter`, exported as `ApiRouter`. The `admin: {…}`
  sub-tree mirrors the URL hierarchy.
- **Mount** (`server/http/app.ts`): one `RPCHandler` at `/rpc/*` with
  `csrfGuard` upstream (handlers never call `validateRequestCsrf`
  themselves). Per-procedure response headers ride through a mutable
  `responseHeaders: Headers` on the context and are merged onto the
  final `Response`.
- **Resource routers** (`server/http/resources/`) are native Hono for
  non-JSON output (RSS/Atom, sitemap.xml, OG images, redirects,
  analytics events). RBAC via
  `server/http/middlewares/hono-rbac.ts::requireRoleMw`.
- **OpenAPI** at `/openapi.json` + `/docs`, auto-generated from
  `apiRouter` in development.

### Adding a new API endpoint

1. **DTO** — new shared schema → `shared/contracts/<domain>.ts` with a
   parity assertion against `src/shared/types/<domain>.ts`. Otherwise
   inline a `z.object({...})` alongside the procedure.
2. **Procedure** — append to the matching controller. Pick the base
   procedure for the auth guard you need.
3. **Compose** — if the controller is already wired in
   `api-router.ts` (most are), nothing else to do. New domain → one
   line under `apiRouter` or `apiRouter.admin`.

UI calls land on `api.<domain>.<resource>.<verb>(flatInput)` — a single
flat input object, no `{ body, query, params }` buckets. Unwrap via
`unwrap()` from `@/client/api/unwrap`. Errors are
`ORPCError('CODE', { message })`; `unwrap()` bridges them back to the
existing `ApiError(message, status, issues)` shape. Use
`.output(z.void())` for 204-like procedures.

## Permission Matrix

| Base procedure | What it does                          | Use for                               |
| -------------- | ------------------------------------- | ------------------------------------- |
| `publicProc`   | No auth gate; `csrfGuard` on non-GET  | Anonymous reads + mutations with CSRF |
| `authedProc`   | `requireAuth` + `csrfGuard`           | Any logged-in user                    |
| `authorProc`   | `requireRole('author')` + `csrfGuard` | Authors and admins                    |
| `adminProc`    | `requireRole('admin')` + `csrfGuard`  | Admins only                           |

Audit surface is one grep:
`grep -rn "adminProc\|authorProc\|authedProc\|publicProc" src/server/http/controllers/`.

Smoke coverage for the four base procedures and the wire format is in
`tests/server.http.orpc-smoke.test.ts`.

## Assets

- Vite emits to `build/client/assets`.
- Production builds do not upload generated assets to S3 and do not
  rewrite URLs through a build-time CDN base.
- Docker builds run `npm run build` and copy local `build/` into the
  runtime image.

## Formatting And Lint

- `.ts`/`.tsx` formatted with `oxfmt`, linted with `oxlint`.
- Comments in Tailwind CSS files (`src/assets/styles/*.css`, especially
  `tailwind.css`) MUST stay minimal — Lightning CSS through Rolldown
  has been observed to choke on heavy comment payloads inside `@theme`/
  `@utility`/`@layer` blocks:
  - One short ASCII line per region, only as a section header — never
    mid-rule, never above an individual declaration.
  - No special characters or punctuation. Plain English or Chinese
    words and spaces only.
  - Decision-log narrative belongs in commit messages, this file, or a
    TS/TSX consumer's comment — never in CSS.
- Git hooks are owned by Vite+. Committed scripts live in
  `.vite-hooks/*` (e.g. `.vite-hooks/pre-commit` → `vp staged`); the
  runtime wrapper `.vite-hooks/_/` is generated by `vp config` and is
  gitignored. The `staged` task list is in `vite.config.ts`.
  `npm install` runs `prepare` → `vp config`. Set `VITE_GIT_HOOKS=0` to
  skip (used by the Dockerfile).

## Defensive Constraints

Landmines from past refactors. Do not reintroduce:

- No `astro.config.ts`, `src/pages`, `.astro` shells, `src/actions`,
  `src/middleware`, `src/layouts`, `src/services`, `src/hooks`,
  `src/db`, `src/assets/scripts`, or `src/content/`. Folded into the
  four-layer architecture.
- No `src/blog.config.ts`, `DEFAULT_SETTINGS`, `BlogConstants`, or
  per-section "重置为默认" reset action.
- No single monolithic `BlogConfigContext`/`<BlogConfigProvider>` on
  the public tree. `<BlogSettingsProvider>` nests one React context per
  section; subscribe with the per-section hook.
- No `data-admin-shell` selector. Branding differences belong in
  component props, not parallel CSS variable trees.
- No `src/lib/` parallel to `@/ui/lib`. shadcn CLI is wired through
  `components.json`'s `aliases.lib = @/ui/lib`.
- No `@/ui/admin/shadcn/components/ui/` nesting. shadcn primitives live
  at `@/ui/components/`; admin domain UIs at `@/ui/admin/`.
- Keep server-only imports inside `src/server/` (or behind dynamic
  imports inside loaders/actions/resource routes).
- Preserve public URLs, feed URLs, image endpoints, WordPress
  compatibility routes, and pagination routes unless explicitly asked
  to change them.
- When moving files, update imports and documentation in the same
  change.
- **Hono / oRPC:**
  - No business logic inside procedure handlers — orchestrate only.
  - Throw `ORPCError('CODE', { message })` from procedures or services
    they invoke. `onErrorHandler` (`server/http/errors.ts`) handles the
    rest. Service layers do not throw `HTTPException`.
  - Do not bypass `apiRouter` with ad-hoc Hono RPC routes. Non-JSON
    resource routes belong in `server/http/resources/`.
  - No raw `fetch('/rpc/...')` string concatenation in client code —
    always call `api.<domain>.<endpoint>(flatInput)` from
    `@/client/api/client`. The client handles serialization, multipart
    for Blob inputs, error normalization, and the `{ json: ... }` RPC
    envelope.
  - Procedure inputs are a single flat object — no
    `{ body, query, params }` buckets.
- **`server/` layering:**
  - `infra/*` imports nothing from `domains/`, `http/`, or `render/`.
    Domain knowledge must not leak into the technical primitives layer.
  - `domains/*` modules may import from `shared/`, `infra/`, and other
    `domains/`. Each domain is self-contained — `schema.ts` / `repo.ts`
    / `service.ts` / `projection.ts` / `cache.ts` plus feature-named
    files. Do not reintroduce `repository.ts` + `query.ts` coexistence;
    pick one. Do not split a domain's schema, queries, or cache into
    `infra/` (`infra/db/operations/` is the only allowed exception —
    raw Drizzle helpers may live there when shared across domains).
  - `http/controllers/*` orchestrate only: validate input, call
    `domains/<x>/service`, project DTO. No business rules, no direct
    SQL. Permission level is encoded by the base procedure
    (`publicProc` / `authedProc` / `authorProc` / `adminProc`); admin
    procedures live under `controllers/admin/` and mount at
    `apiRouter.admin.<name>`.
  - `http/loaders/*` are React Router data orchestrators (detail /
    listing / search / comments / sidebar). They may call domain
    services freely but must not contain reusable business rules.
  - `render/*` produces strings / Buffers / Responses and never
    persists. Caching results is the caller's responsibility.
  - No barrel `index.ts` files inside any `server/` subtree —
    callers import the concrete module path.
- **Deleted shapes (do not reintroduce):** `server/audit/`,
  `server/content/`, `server/present/`,
  `server/settings/sidebar/`, `server/settings/install/`,
  `server/infra/cache/`, `server/infra/db/query/`,
  `server/images/og.ts`, `server/images/calendar.ts`,
  `server/images/serve-calendar.ts`, `server/images/avatar-fetch.ts`,
  `server/images/render-enhance.ts`, `server/images/assets.ts`,
  `server/images/compress.ts`, `comment-{public,self,token,admin}.controller.ts`,
  `taxonomies/{category,tag}-{schema,service}.ts`.

## Git And Commits

- Do not create commits unless explicitly asked.
- Before staging/committing, inspect `git status --short` and avoid
  mixing unrelated user changes.
- Commit messages: semantic `<type>: <summary>` or
  `<type>(<scope>): <summary>` (`feat`, `fix`, `docs`, `refactor`,
  `test`, `chore`). ASCII colon + one space. Imperative, concise
  English summary. Multi-line: blank line after subject, bullets focused
  on user-visible or reviewer-relevant changes.
- Before committing code changes, run `vp check`, `vp test run`, and
  `vp build`.

## Vite+, the Unified Toolchain

Vite+ wraps Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task
in a single CLI `vp`. Run `vp help` for the full list.

| Command                     | Purpose                                                 |
| --------------------------- | ------------------------------------------------------- |
| `vp install` (`vp i`)       | Install dependencies                                    |
| `vp dev`                    | Development server                                      |
| `vp check`                  | Format, lint, and TypeScript checks                     |
| `vp lint` / `vp fmt`        | Lint or format only                                     |
| `vp test`                   | Run tests (`vp test run` for one-shot)                  |
| `vp build`                  | Production build                                        |
| `vp preview`                | Preview the production build                            |
| `vp run <script>`           | Run a `package.json` script (e.g. `vp run dev`)         |
| `vp dlx <bin>`              | Execute a package binary without installing it          |
| `vp dlx vite-node <script>` | Run a TS script with Vite aliases and `import.meta.env` |

Deps: `vp add` / `vp remove` / `vp update`. Vite+ detects the active
package manager from `packageManager` in `package.json`.

### Pitfalls

- Do not run pnpm, npm, or Yarn directly.
- `vp dev`/`vp build`/`vp test` always run the Vite+ tool, never a
  same-named `package.json` script. Use `vp run <script>` for custom
  scripts.
- No `vp vitest`/`vp oxlint` subcommands.
- Do not install Vitest, Oxlint, Oxfmt, or tsdown directly — Vite+ pins
  them.
- Import test utilities from `vite-plus/test`, not `vitest` or `vite`.
- `vp lint --type-aware` works out of the box; do not install
  `oxlint-tsgolint`.

### CI

Prefer [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp):

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```
