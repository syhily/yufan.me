# AGENTS.md

Repository conventions for AI agents and contributors. Read this before
authoring routes, content loaders, templates, React components, or server
code. `CLAUDE.md` is a `git`-tracked symlink to this file. Edit only
`AGENTS.md`.

## Skills Are the Baseline

Conventions below are calibrated against the agent Skills under
`.claude/skills/` and `.agents/skills/`, kept in sync via
`skills-lock.json`. Open SKILL.md and any referenced rule files _before_
writing code when a task triggers one:

| Skill                         | Triggers                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `react-router-framework-mode` | Routes, loaders, actions, forms, navigation, `react-router.config.ts`.         |
| `vercel-react-best-practices` | Any React/SSR code. The 70 numbered rules are the performance baseline.        |
| `vercel-composition-patterns` | New components, boolean-prop matrices, compound components, context providers. |
| `shadcn`                      | shadcn/ui components, presets, `components.json`.                              |
| `tailwind-design-system`      | CSS tokens, design-system primitives, Tailwind v4 `@theme` changes.            |
| `web-design-guidelines`       | UI accessibility, UX, Web Interface Guidelines compliance.                     |

Skills win on conflict. Quote stable rule ids in PR review (e.g.
`bundle-barrel-imports`, `architecture-avoid-boolean-props`,
`server-no-shared-module-state`). Out-of-scope topics fall back to this
document and upstream library docs.

## Stack

- React Router 7 Framework Mode with SSR (`appDirectory: 'src'`,
  `future.v8_middleware`). Vite (via Vite+) builds; `vite.config.ts`
  wires React Router, binary assets, path aliases, dev server.
- React 19 TSX/TS only.
- Postgres for users, comments, likes, counters, settings, taxonomies,
  posts, pages, images, music. Redis for sessions, rate limits, avatars,
  generated-image caches.
- Posts and pages live in Postgres (`post`/`page` + `content`); edited
  at `/wp-admin/{posts,pages,categories,tags,friends,images,musics}`.
- Path alias: `@/*` → `./src/*`. No `~/*` alias. `public/*` is served at
  the root URL — reference by absolute URL, not TS import. Use aliases
  over relatives. Allowed relatives: `src/routes.ts` → `./...` (React
  Router reads the manifest before Vite resolves aliases),
  `./+types/*` (route type codegen), and `vite.config.ts` / plugins
  (must use explicit `.ts` specifiers; `allowImportingTsExtensions` is
  on).

## Architecture

Five top-level layers under `src/` with a one-way import graph:

```
src/
├── routes/      # Loader / action / meta / component orchestration.
├── server/      # SSR-only logic (see four-layer breakdown below).
├── client/      # Browser-side: hooks, oRPC client, browser APIs.
├── ui/          # Pure-props React components.
├── shared/      # Isomorphic, side-effect-free modules.
├── assets/      # Static assets (icon SVGs, fonts, styles).
├── routes.ts    # Route manifest (URL → route module).
├── root.tsx     # Document shell.
└── server.ts    # Hono entry / SSR adapter.
```

### `src/routes/` — Orchestration Only

Page modules grouped into four nested trees, each with its own layout
(`routes/<tree>/layout.tsx`):

- `routes/public/` — public site. Layout + `home`, `archives`,
  `categories`, `category/list`, `tag/list`, `search/list`,
  `post/detail`, `page/detail`, `not-found`.
- `routes/auth/` — split-screen login + install: `wp-login`,
  `install/index` (`/wp-admin/install.php`), `install/settings`
  (`/wp-admin/install/settings.php`).

- `routes/wp-admin/` — admin SPA. `dashboard`, `welcome`, `comments`,
  `users/{index,detail}`, `my/{profile,comments,sessions}`, `sessions`,
  `friends`, `categories`, `tags`, `pages/{index,new,edit}`,
  `posts/{index,new,edit}`, `images`, `musics`,
  `analytics/{layout,overview,realtime}`, `settings/{layout,…}` —
  one file per settings section.

Read session/context at the perimeter, call into `server/`, project
DTOs through `shared/`, render with `ui/`. No DB queries, Redis access,
or markdown parsing inline. Public URLs and physical paths stay stable
— React Router derives route ids from the file path.

Use `loader` for render-time data, `action` for route form submissions.
Use `redirect`, `data`, `Response`, and thrown responses for control
flow. **Non-page requests** (API, feeds, sitemap, generated images) are
served by Hono native routes mounted in `server.ts`, NOT React Router
resource routes.

### `src/server/` — SSR Only

May import from `shared/` and other `server/`. Must not import from
`client/` or `ui/`. Internal four-layer tree with a strict one-way
graph (`infra → domains → http`, `domains → render → http`):

```
server/
├── infra/      # Technical primitives — zero business knowledge.
├── domains/    # Self-contained business modules (one folder per domain).
├── http/       # HTTP perimeter (oRPC + Hono).
└── render/     # SSR output products (HTML, RSS/Atom, OG, calendar, avatar, SEO).
```

- **`server/infra/`** — Pure primitives. `db/` (Drizzle pool, schema,
  migrations, `operations/<entity>.ts` raw helpers), `redis/`
  (unstorage + ioredis: storage, buckets, inflight, `buffer-cache`,
  `admin-ops`), `http/` (generic `etag`, `headers`, `status`, `errors`
  with `DomainError` / `ActionFailure`), `email/` (sender + React
  Email), `search/` (openai client, vector driver), `env.ts`,
  `logger.ts`, `rate-limit.ts`, `slug.ts`. Imports nothing from
  `domains/`, `http/`, or `render/`.
- **`server/domains/`** — One folder per business domain. Locked
  vocabulary: `schema.ts / repo.ts / service.ts / projection.ts /
cache.ts` plus feature-named files (`preview.ts`, `loader.ts`, etc.).
  Domains: `analytics`, `auth` (session-storage, csrf, rbac, flows,
  verification-tokens), `catalog` (build, snapshot, queries, fence,
  invalidate), `comments` (loader, moderation, projection, likes, token,
  badge, url, canonicalize), `friends`, `images` (schema, service,
  storage, key, process), `music`, `pages`, `posts`, `pt`
  (Shiki/KaTeX/Mermaid prerender, canonicalize, comment-to-html),
  `settings` (sections, snapshot, install-flow, install-gate),
  `taxonomies/{categories,tags}`, `users`. Plus `content-revisions.ts`
  and `audit.ts`. Domains may import from `shared/`, `infra/`, and
  other `domains/`. `tests/contract.cookie.test.ts` pins
  `domains/auth/session-storage.ts`. `src/server/session.ts` is a
  deprecated barrel preserved for `vi.mock('@/server/session')`;
  production code imports `domains/auth/*` directly.
- **`server/http/`** — HTTP perimeter only. Procedure base
  (`orpc-base.ts`), context, composed router (`api-router.ts`), error
  hook (`errors.ts`), OpenAPI export (`openapi.ts`), Hono entry
  (`app.ts`); `middlewares/` (session, csrf, install-gate, rate-limit,
  trailing-slash, visitor-cookie, wp-decoy, hono-rbac); `controllers/`
  (per-domain `<name>.controller.ts`, admin under `controllers/admin/`);
  `resources/` (non-JSON: feed, sitemap, images, redirects,
  analytics-events); `loaders/` (React Router data orchestrators:
  detail, listing, search, comments, sidebar, pagination, revalidate,
  route-exports). Controllers and loaders **orchestrate only** —
  business logic stays in `domains/<x>/service.ts`.
- **`server/render/`** — SSR output products. `seo/`, `feed/`
  (RSS/Atom + PT-feed renderer), `og/`, `calendar/` (SVG + Hono serve
  helper), `avatar/` (Gravatar/QQ fetcher + Redis cache),
  `react-prerender.ts`, `image-enhance.ts` (feed HTML post-processor),
  `image-compress.ts` (shared PNG helper). Never persists — produces
  strings, Buffers, or Responses.

### `src/client/` — Browser Only

- `hooks/` (browser hooks) and `api/` (oRPC client). All HTTP calls go
  through `api.<domain>.<endpoint>(flatInput)` from
  `@/client/api/client`. The typed client is built from
  `typeof apiRouter`. `unwrap()` translates oRPC `ORPCError` rejections
  into `ApiError`. TanStack Query wrappers in `@/client/api/orpc-query`
  and `@/client/api/query`.
- Heavy widgets (e.g. `qrcode.react`) reach the bundle via React.lazy +
  Suspense from a UI component, not top-level imports
  (`bundle-dynamic-imports`).
- May import from `shared/` and other `client/`. Must not import any
  `server/` module or Node-only API.

### `src/ui/` — Pure-Props Components

Components receive explicit props. No reads from sessions, route
params, request objects, or env vars. State lives at the route module
or the closest interactive parent. Three tiers:

- **`ui/components/`** — shadcn/ui primitives (Base UI variant), flat
  so `npx shadcn@latest add/diff` works. `components.json` aliases
  `components` and `ui` here. One token cascade in `:root`
  (`tailwind.css`) covers public + admin.
- **`ui/public/`** — `chrome/`, `post/`, `comments/`, `widgets/`, plus
  single-file leaves (`Search.tsx`, `Sidebar.tsx`, `LikeActions.tsx`).
- **`ui/admin/`** — grouped by domain (`analytics`, `auth`,
  `categories`, `comments`, `editor`, `editor-shell`, `friends`,
  `images`, `musics`, `my`, `pages`, `posts`, `sessions`, `settings`,
  `tags`, `users`, `welcome`, plus `shared/` and `shell/`).
  - `editor/` — the Tiptap micro-app (`PageBodyEditor`, `tiptap/`,
    `toolbar/`, `pickers/`, `FootnoteEditorDialog`,
    `portable-text-diff`). Self-contained; only `PageBodyEditor` is
    imported by other admin domains.
  - `editor-shell/` — the business-orchestration layer that wraps the
    Tiptap editor into a draft/publish workflow:
    `useEditorShellState` (shared FSM for both Post + Page editor
    shells — body/meta drafts, draft-conflict resolution, autosave,
    revision-token race, persist save/publish/unpublish, keyboard
    shortcuts, layout toggles), `DraftConflictDialog`,
    `FloatingPublishButton`, `PreviewPanel`, `RevisionsDrawer`,
    `DateTimePicker`. `PostEditorShell.tsx` and `PageEditorShell.tsx`
    consume the hook + sub-components and stay thin (~500 LOC each)
    by encoding only their entity-specific bindings (DTO key shape,
    API endpoint paths, sidebar component, mutation payload fields,
    UI text). No new shared state belongs in either Shell — extend
    `useEditorShellState` instead.

Cross-cutting at the top of `ui/`:

- `ui/pt/` — PortableText SSR renderer split across `render.tsx`
  (entry, components map, recursive blocks, FootnotesSection),
  `render-blocks.tsx` (12 block renderers + table inline-span
  helpers), `render-marks.tsx` (3 mark renderers +
  `renderMathMarkupOrTexFallback`), `render-shared.ts` (PT_INLINE
  class tokens + 4 React contexts). Plus `Footnotes.tsx`,
  `image-meta-context.tsx`, and custom-block components under
  `ui/pt/blocks/` (CodeBlock, BlockImage, MusicPlayer, Solution,
  Friends).
- `ui/icons/` — Static-export icon library. Named imports only — no
  `<Icon name="..." />` string lookups.
- `ui/lib/` — UI utilities (`cn`, `code-languages`, `ThemeProvider`,
  `blog-config-context`, `use-media-query`). shadcn's `aliases.lib` is
  pinned here. No `src/lib/` parallel.

Rules:

- Raw HTML uses `dangerouslySetInnerHTML` on the host element — no
  generic `Html` wrapper.
- Conditional classNames go through `cn()` from `@/ui/lib/cn`. It
  composes `clsx` with a project-customised `tailwind-merge` that
  registers every `@theme` token. Adding a new `--<namespace>-<name>`
  token in `tailwind.css` MUST be paired with an entry in `cn.ts`'s
  per-namespace list — enforced by
  `tests/contract.tailwind-tokens.test.ts`.
- Use `<Image />` from `@/ui/public/widgets/Image` for transformed
  remote images.

### `src/shared/` — Isomorphic Only

Side-effect-free, safe in both bundles. Forbidden: `node:*`, `ioredis`,
`drizzle-orm`, DOM-only APIs, direct `process.env`.

- `config/` — `blog`, `settings`, `socials` (BlogSettingsBundle).
- `contracts/` — Zod schemas (the wire format).
- `types/` — DTO interfaces (parity-checked against `contracts/`).
- `pt/` — PortableText schema, bridge, semantics, comment markdown,
  footnote-merge.
- `utils/` — `urls`, `safe-url`, `request`, `security`, `tools`,
  `formatter`, `pagination`, `toc`, `paths`, `roles`, `user-agent`,
  `chunk-error`, `comment-token`, `footnotes-section-title`.

### Layering enforcement

- `server/*` may import `shared/*` and other `server/*`. Not `client/*`
  or `ui/*`.
- `client/*` and `ui/*` may import `shared/*`, `ui/*`, `client/*`. Not
  any `server/*` module or `.server.*` file.
- `shared/*` imports `shared/*` only. Runs in both bundles without
  polyfills.
- `routes/*` may import from any layer; route components must accept
  plain props and not reach back into `server/*` inside the JSX tree.
- `*.server.ts` suffix is redundant inside `src/server/`; only needed
  for modules outside it that must never reach the client (none should
  remain by design).
- Avoid barrel `index.ts` files (`bundle-barrel-imports`).
- Skill rules reviewers cite: `server-no-shared-module-state`,
  `server-cache-react`, `bundle-analyzable-paths`,
  `bundle-dynamic-imports`, `rendering-resource-hints`, `rerender-memo`.

## Component Rules

- Plain TSX with explicit props. No hidden reads from route params,
  sessions, request objects, or env vars.
- Compose with children and slots, not boolean prop matrices
  (`architecture-avoid-boolean-props`).
- Prefer compound components over render-prop callbacks. Recursive
  components recurse by component name.
- React 19: no `forwardRef` for new components — refs flow through
  props.

## Client Interactivity

- All interactivity lives in components/hooks under `@/client/` and
  `@/ui/` as React islands. No separate browser-script pipeline
  (`src/assets/scripts` is intentionally absent).
- Interactive components call resource URLs through the oRPC client.
  No server-module imports (a type-only import for
  `RouterClient<ApiRouter>` is the one allowed exception — `import
type` erases at compile time).
- Avoid new client deps unless the interaction needs them.

### iOS auto-zoom contract

iOS Safari zooms in when focusing a control with `font-size < 16px`.
Instead of a typographic floor (would break density), every form
control inherits an app-wide hook that disables user-scaling on the
viewport `<meta>` while any control is focused.

- Single source: `useIosNoZoomOnFocus()` in
  `@/client/hooks/use-ios-no-zoom`, mounted **once** at the top of
  `src/root.tsx`'s `App`. Document-level `focusin`/`focusout` covers
  every `INPUT`/`TEXTAREA`/`SELECT`. Do NOT re-install per-form — two
  listeners race the same `<meta>` rewrite. Gated to iOS/iPadOS WebKit;
  other platforms no-op. Focus traversal keeps the lock; the meta value
  restores only when focus leaves form-control DOM entirely.

## Content

### Posts and pages

- `post` + `content` → `/posts/:slug`. `page` + `content` → `/:slug`.
  Both rendered via `<PortableTextBody>`. Public URLs use `slug`, not
  internal id.
- `@/server/domains/catalog` serves compiled body, headings, raw source,
  and listing fields. Custom block components in `@/ui/pt/blocks/`.
- `visible=false` posts are hidden from the public home and random-post
  widgets but stay in `/archives`, `/tags/:slug`, `/search/:keyword`,
  `sitemap.xml`, feeds, and category/tag listings and counts.
  Future-dated posts stay excluded until publish time.
- **Post default cover image.** Both `toCmsPost` (detail page) and
  `toClientPostFromMeta` (listings) must fall back to
  `/images/open-graph.png` when `meta.cover` is empty. This prevents
  broken `<Image src="" />` renders in article cards and failed OG
  image generation. Any new projection function that produces a public
  `cover` field MUST replicate this fallback and be covered by a unit
  test in `tests/service.cms-posts-projection.test.ts`.
- **Draft post visibility gate.** A post is considered draft (invisible
  to the public) when `published=false` OR `publishedRevisionId=null`.
  The admin lifecycle filter treats both cases as draft; all public
  queries (`buildPublicPostsWhere`, `isCatalogVisible`, `findPostBySlug`)
  MUST check both conditions. A post with `published=true` but no
  published revision must NOT appear on the home page, in listings,
  feeds, or sitemap.

### Taxonomies (categories, tags, friends)

- Postgres tables edited from `/wp-admin/{categories,tags,friends}`.
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
  `@/server/domains/catalog/fence::validatePageSlugs`, run at catalog
  cold start and after every admin save (a colliding save succeeds at
  save time and surfaces as a 500 on the next rebuild). New slug
  emitters MUST fold into `postSlugs` or `validatePageSlugs`.

### Page draft preview

- `routes/public/page/detail.tsx` paints a red admin-only badge via
  `PageDetailBody`'s `draftMarker` prop. Catalog miss → anonymous 404,
  admin sees latest draft with **【草稿】**. Catalog hit + `?draft=true`
  → anonymous ignores; admin sees overlay with **【未发布的草稿】**
  (newer draft exists) or **【已发布的草稿】** (latest revision IS the
  published one).
- Discriminator: `'draft' | 'unpublished-draft' | 'published-draft' | null`
  in `@/ui/public/post/PageDetailBody`. Service is
  `loadPageDraftPreviewBySlug` returning `{ page, hasNewerDraft }`.

### Page meta toggles

- `page` carries operator-facing booleans (`comments_enabled`,
  `show_toc`, `show_friends`) edited from `MetaSidebar` and consumed by
  `routes/public/page/detail.tsx` as render-time branches — never body
  mutations. `show_friends` appends the global friends grid below the
  body before the Like button; PortableText has no `friends` block.
- Adding a toggle touches: db schema + migration + snapshot, page
  projection, page service + schema, shared DTOs + catalog type,
  `MetaSidebar` + `PageEditorShell`, and the `CreateDraftMeta` mirror
  in `@/client/hooks/use-create-page-draft`. Test fixtures in
  `tests/_helpers/catalog.ts` + `tests/service.cms-pages*.test.ts` need
  the new default.

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

- Zod dialect: `@/shared/pt/schema` (text / list / heading / blockquote
  - custom blocks `image`, `code`, `mathBlock`, `mermaid`,
    `horizontalRule`, `musicPlayer`, `solution`, `footnoteDefinition`,
    `table`). Friends grid is NOT a body block — it's the
    `page.show_friends` toggle.
- Server-only PT helpers in `@/server/domains/pt/*` (prerender,
  canonicalize) must never reach the client bundle.
- PT ↔ ProseMirror bridge is `@/shared/pt/bridge` — single file. Custom
  blocks ride a generic `blockCard` PM node. Round-trip is
  contract-tested in `tests/contract.pt-bridge.test.ts`.
- SSR renderer is `@/ui/pt/render` (`PortableTextBody`), composing
  `@portabletext/react` with `@/ui/pt/blocks/*`. Heading anchor ids
  align with post anchors.
- Admin editor is `@/ui/admin/editor/PageBodyEditor` (shared by pages
  and posts). UX: toolbar (image library / music picker / link / table
  / hr / undo-redo) → `tiptap/BubbleMenu` (text selection: B/I/U +
  code + link + `mathInline`/`footnoteRef`) and
  `tiptap/TableBubbleMenu` (table selection), mutually exclusive →
  `tiptap/SlashMenu` (`@tiptap/suggestion`, catalogue in
  `tiptap/slash-commands.ts`; pickers dispatch `CustomEvent`s from
  `tiptap/editor-events.ts`).
- Image block uses a React NodeView (`tiptap/ImageNodeView`) for inline
  alt + caption edits.
- **Table dialect**: cells are inline-only — no nested blocks, lists,
  code blocks, math blocks, or footnote refs. Only `link` mark-defs.
  Slash-menu / toolbar inserts a 3×3 table with a header row.
- Floating popups anchor with `position: fixed` driven off the
  suggestion plugin's `clientRect` or Tiptap's `BubbleMenu` positioner.
  Do **not** add `@floating-ui/*` directly — `@base-ui/react` pulls it
  in transitively.

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
  edited at `/wp-admin/settings/assets`. No `ASSET_HOST` /
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
  per-section hook (`useSiteIdentity`, `useAssetsSettings`, …). Each
  hook has strict (throws) and `…Optional` variants. **New UI MUST
  NOT** read the aggregated `useBlogSettingsBundle()` — reading a slice
  you don't need re-renders on every unrelated section save.
- Install flow is two stages, gated by admin login:
  1. `routes/auth/install/index.tsx` (`/wp-admin/install.php`) creates
     the first admin row and auto-logs in. Redirects to stage 2.
  2. `routes/auth/install/settings.tsx`
     (`/wp-admin/install/settings.php`) persists `blog.general` and
     `blog.assets` from the form AND seeds the remaining 12 sections
     from `SECTION_REGISTRY[<section>].defaults`. All 14 rows are
     written atomically. `blog.assets` defaults to upload toggle OFF.
- `honoInstallGateMiddleware`
  (`@/server/http/middlewares/install-gate.ts`) reads
  `getInstallState()` and routes: no admin → `/wp-admin/install.php`;
  admin present but settings missing →
  `/wp-admin/install/settings.php`; installed → through. Static assets,
  framework internals, and the install/login trio are exempt via
  `ensureInstalledOrRedirect()` / `ensureNoAdminOrRedirect()` /
  `ensureNoSettingsOrRedirect()` — exactly one helper throws per state.
- Pre-existing deployments missing optional sections are backfilled
  lazily by `loadSettingsFromDb()` + `upsertSetting`. Best-effort,
  swallows DB errors.
- Admin saves go through `api.admin.settings.update` (oRPC), which
  validates against `SECTION_REGISTRY[section].schema` and writes ONLY
  that one row. No aggregate "reset to defaults" action.

## API Layer (Hono + oRPC)

- **Base procedures** (`server/http/orpc-base.ts`) built off
  `os.$context<HandlerContext>()`. Each chains its own auth/role
  middleware; the leaf procedure picks one and inherits the guard.

  | Base         | Guard                                 | Use for                    |
  | ------------ | ------------------------------------- | -------------------------- |
  | `publicProc` | No auth gate; `csrfGuard` on non-GET  | Anonymous + CSRF mutations |
  | `authedProc` | `requireAuth` + `csrfGuard`           | Any logged-in user         |
  | `authorProc` | `requireRole('author')` + `csrfGuard` | Authors and admins         |
  | `adminProc`  | `requireRole('admin')` + `csrfGuard`  | Admins only                |

- **Controllers** (`server/http/controllers/<domain>.controller.ts`,
  admin under `controllers/admin/`). Shape:
  `procBase.input(zod).output(zod).handler(({input, context}) => …)`,
  exported on the file's `<domain>Router`. Handlers orchestrate only;
  business logic stays in `server/domains/<x>/service.ts`.
- **Zod DTOs** in `shared/contracts/` are paired with compile-time
  `Equals<z.infer, TInterface>` parity assertions against
  `src/shared/types/*.ts`. Drift becomes a build error.
- **Router** (`server/http/api-router.ts`) groups per-domain routers
  into `apiRouter` (`ApiRouter`). The `admin: {…}` sub-tree mirrors the
  URL hierarchy. **Mount** (`app.ts`): one `RPCHandler` at `/rpc/*`
  with `csrfGuard` upstream — handlers never call
  `validateRequestCsrf` themselves. Per-procedure response headers ride
  through a mutable `responseHeaders: Headers` on the context and are
  merged onto the final `Response`.
- **Resource routers** (`server/http/resources/`) are native Hono for
  non-JSON output. RBAC via
  `server/http/middlewares/hono-rbac.ts::requireRoleMw`.
- **OpenAPI** at `/openapi.json` + `/docs`, auto-generated from
  `apiRouter` in development.
- **Audit permissions** with one grep:
  `grep -rn "adminProc\|authorProc\|authedProc\|publicProc" src/server/http/controllers/`.
  Smoke coverage in `tests/server.http.orpc-smoke.test.ts`.

**Adding an endpoint**: (1) shared schema → `shared/contracts/<domain>.ts`
with a parity assertion, OR inline `z.object({...})` next to the
procedure; (2) append a procedure to the matching controller, picking
the right base; (3) controller already wired in `api-router.ts`?
done — else add one line under `apiRouter` or `apiRouter.admin`.

UI calls `api.<domain>.<resource>.<verb>(flatInput)` — single flat
input, no `{ body, query, params }` buckets. Unwrap via `unwrap()`
from `@/client/api/unwrap`. Errors are `ORPCError('CODE', { message })`;
`unwrap()` bridges to `ApiError(message, status, issues)`. Use
`.output(z.void())` for 204-like procedures.

## Build & Tooling

- Vite emits to `build/client/assets`. Production builds don't upload
  generated assets to S3 and don't rewrite URLs through a build-time
  CDN base. Docker builds run `npm run build` and copy local `build/`
  into the runtime image.
- `.ts`/`.tsx` formatted with `oxfmt`, linted with `oxlint`.
- Comments in Tailwind CSS files (`src/assets/styles/*.css`, especially
  `tailwind.css`) MUST stay minimal — Lightning CSS through Rolldown
  chokes on heavy comment payloads inside `@theme` / `@utility` /
  `@layer` blocks. One short ASCII line per region as a section header
  — never mid-rule, never above a declaration. No special characters
  or punctuation; plain English/Chinese words only. Decision-log
  narrative belongs in commit messages, this file, or a TS/TSX
  consumer's comment — never in CSS.
- Git hooks owned by Vite+. Committed scripts in `.vite-hooks/*` (e.g.
  `pre-commit` → `vp staged`); the runtime wrapper `.vite-hooks/_/` is
  generated by `vp config` and gitignored. `staged` task list in
  `vite.config.ts`. `npm install` runs `prepare` → `vp config`. Set
  `VITE_GIT_HOOKS=0` to skip (Dockerfile).

### Vite+ (the `vp` CLI)

Wraps Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Run
`vp help` for the full list. Common: `vp dev`, `vp check` (format +
lint + types), `vp lint`, `vp fmt`, `vp test` / `vp test run`, `vp
build`, `vp preview`. Run package.json scripts with `vp run <script>`.
Deps: `vp add` / `vp remove` / `vp update` (detects the active package
manager from `packageManager`).

Pitfalls:

- No pnpm / npm / Yarn directly. `vp dev`/`vp build`/`vp test` always
  run the Vite+ tool, never a same-named package.json script — use
  `vp run <script>` for those.
- No `vp vitest` / `vp oxlint` subcommands.
- Don't install Vitest, Oxlint, Oxfmt, or tsdown directly — Vite+ pins
  them.
- Import test utilities from `vite-plus/test`, not `vitest` or `vite`.
- `vp lint --type-aware` works out of the box; don't install
  `oxlint-tsgolint`.

CI: prefer
[`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) →
`vp check` + `vp test`.

## Defensive Constraints

Landmines from past refactors. Do not reintroduce:

- No `astro.config.ts`, `src/pages`, `.astro` shells, `src/actions`,
  `src/middleware`, `src/layouts`, `src/services`, `src/hooks`,
  `src/db`, `src/assets/scripts`, or `src/content/`.
- No `src/blog.config.ts`, `DEFAULT_SETTINGS`, `BlogConstants`, or
  per-section "重置为默认" reset action.
- No monolithic `BlogConfigContext`/`<BlogConfigProvider>` on the
  public tree. `<BlogSettingsProvider>` nests one React context per
  section; subscribe with the per-section hook.
- No `data-admin-shell` selector. Branding differences belong in
  component props, not parallel CSS variable trees.
- No `src/lib/` parallel to `@/ui/lib`. shadcn CLI is wired through
  `components.json`'s `aliases.lib = @/ui/lib`.
- No `@/ui/admin/shadcn/components/ui/` nesting. shadcn primitives at
  `@/ui/components/`; admin domain UIs at `@/ui/admin/`.
- Keep server-only imports inside `src/server/` (or behind dynamic
  imports inside loaders/actions/resource routes).
- Preserve public URLs, feed URLs, image endpoints, WordPress
  compatibility routes, and pagination routes unless explicitly asked
  to change them.
- When moving files, update imports and documentation in the same
  change.
- **`ui/` complex-component LOC ceiling:** stateful orchestrators
  (editor shells, multi-stage forms, comment threads, PortableText
  renderers) should aim for ≤500 LOC per file. When a single file
  grows past that, extract: shared state into a hook (e.g.
  `useEditorShellState` for the Post + Page editor shells), reusable
  sub-components into siblings (e.g. `ui/public/comments/comment-item/`
  for the 7-file CommentItem split), or per-renderer modules
  (`ui/pt/render-{shared,marks,blocks}` for the PortableText
  pipeline). The benchmark is "another agent can read and modify the
  file without scrolling past unrelated concerns."
- **`server/` layering:**
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
- **Hono / oRPC:**
  - No business logic inside procedure handlers.
  - Throw `ORPCError('CODE', { message })` from procedures or services.
    `onErrorHandler` (`server/http/errors.ts`) handles the rest.
    Service layers do not throw `HTTPException`.
  - Do not bypass `apiRouter` with ad-hoc Hono RPC routes. Non-JSON
    resource routes belong in `server/http/resources/`.
  - No raw `fetch('/rpc/...')` in client code — always call
    `api.<domain>.<endpoint>(flatInput)`. The client handles
    serialization, multipart Blob inputs, error normalization, and the
    `{ json: ... }` RPC envelope.
  - Procedure inputs are a single flat object — no
    `{ body, query, params }` buckets.

## Git And Commits

- Do not create commits unless explicitly asked. Before staging,
  `git status --short` and avoid mixing unrelated user changes.
- Commit message: semantic `<type>: <summary>` or
  `<type>(<scope>): <summary>` (`feat`, `fix`, `docs`, `refactor`,
  `test`, `chore`). ASCII colon + one space. Imperative English
  summary. Multi-line: blank line after subject; bullets focused on
  user-visible or reviewer-relevant changes.
- Before committing code changes, run `vp check`, `vp test run`, and
  `vp build`.
