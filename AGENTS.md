# AGENTS.md

Repository conventions for AI agents and contributors. Read this before
authoring routes, content loaders, templates, React components, or server
code.

`CLAUDE.md` is a `git`-tracked symlink to this file. Edit only `AGENTS.md`.

## Skills Are the Baseline

Conventions below are calibrated against the agent Skills under
`.claude/skills/` (Claude Code) and `.agents/skills/` (Cursor / generic
runtimes), kept in sync via `skills-lock.json`.

| Skill                         | When the agent must read it                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `react-router-framework-mode` | Adding routes, loaders, actions, forms, navigation, error boundaries, sessions, or touching `react-router.config.ts`. |
| `vercel-react-best-practices` | Writing or refactoring any React/SSR code. The 70 numbered rules are the project's performance baseline.              |
| `vercel-composition-patterns` | Designing new components, refactoring boolean-prop matrices, or building compound components / context providers.     |
| `shadcn`                      | Adding, updating, debugging, or styling shadcn/ui components, switching presets, or working with `components.json`.   |
| `tailwind-design-system`      | Authoring CSS tokens, design-system primitives, or any Tailwind v4 `@theme` change.                                   |
| `web-design-guidelines`       | Reviewing UI for accessibility, UX, and Web Interface Guidelines compliance.                                          |

- **Read before authoring.** Open SKILL.md and any referenced rule files
  _before_ writing code when a task triggers one of the Skills.
- **Skills win on conflict.** Fix this document via PR rather than
  re-introducing an older rule.
- **Quote stable rule ids in PR review** (e.g. `bundle-barrel-imports`,
  `architecture-avoid-boolean-props`, `server-no-shared-module-state`).
- **Out-of-scope topics** (Drizzle migrations, Vite+ tooling) fall back to
  this document and upstream library docs.

## Stack

- React Router 7 Framework Mode with SSR. `react-router.config.ts` keeps
  `appDirectory` at `src` and enables `future.v8_middleware`.
- Vite (via Vite+) is the build system. `vite.config.ts` wires React
  Router, binary asset imports, path aliases, and dev server settings.
- Posts and pages both live in Postgres (`post` + `content` and `page` +
  `content` tables) and are edited through `/wp-admin/{posts,pages}`.
  Categories, tags, and friends live in Postgres and are edited through
  `/wp-admin/{categories,tags,friends}`.
- React 19 view layer. TSX/TS only.
- Postgres for users, comments, likes, counters, settings, taxonomies,
  images, music. Redis for sessions, rate limits, avatars, and
  generated-image caches.

## Architecture

Four cooperating layers under `src/` with a one-way import graph so the
server bundle and the client bundle stay independently reasonable.

```
src/
├── routes/           # Loader / action / meta / component orchestration.
├── server/           # SSR-only logic. DB, Redis, session, mail, cache, services.
├── client/           # Browser-side logic. Hooks, fetchers, browser APIs.
├── ui/               # Pure-props React components.
├── shared/           # Isomorphic, side-effect-free modules.
├── content/          # Post MDX sources + LICENSE (not DB pages).
├── assets/           # Static assets (icon SVGs, fonts, styles).
├── env.d.ts
├── react-router.d.ts
├── routes.ts         # Route manifest (URL → route module).
└── root.tsx          # Document shell. Owns global UI.
```

### `src/routes/` — Orchestration Only

- `*.tsx` are page route modules with `loader` / `action` / `meta` /
  default component.
- `*.ts` are resource routes (feeds, sitemap, generated images).
- **API endpoints live on the oRPC + Hono perimeter** — controllers
  build procedures under `src/server/http/controllers/` from base
  procedures in `src/server/http/orpc-base.ts`; the composed
  `apiRouter` (`src/server/http/api-router.ts`) is mounted at
  `/rpc/*` via `RPCHandler`. Non-JSON output (RSS/Atom, sitemap.xml,
  OG images, calendars, avatars) lives in `src/server/http/resources/`
  as native Hono routers. The legacy `src/routes/api/actions/` tree
  and the `/api/actions/*` redirect table are both removed.
- Route modules orchestrate: read session/context at the perimeter, call
  into `server/`, project DTOs through `shared/`, render with `ui/`.
  No DB queries, Redis access, or markdown parsing inline.
- Public URLs and route module physical paths must stay stable —
  React Router derives stable route IDs from the file path.

### `src/server/` — SSR Only

- Sub-areas (each owns its loader, schema, and helpers):
  - `server/db/` — Drizzle pool, schema, query helpers, migrations.
  - `server/http/` — Hono + oRPC API perimeter. Procedure base
    factory (`server/http/orpc-base.ts`), controllers building
    procedures (`server/http/controllers/`), composed router
    (`server/http/api-router.ts`), resource routers
    (`server/http/resources/`), Hono RBAC helper for resource routers
    (`server/http/hono-rbac.ts`), and OpenAPI export
    (`server/http/openapi.ts`).
  - `server/route-helpers/` — Legacy response helpers (`ok`, `fail`,
    `ActionFailure`) still used by some service layers during the
    migration window.
  - `server/middleware/` — Historical React Router middleware. All
    perimeter middleware (session, install-gate, wp-decoy, visitor-cookie)
    now lives in `server/http/` as Hono middleware.
  - `server/auth/` + `server/session.ts` — Cookie session, CSRF,
    request context, login flow. `tests/contract.cookie.test.ts` treats
    these file paths as a contract; keep them in sync.
  - `server/catalog/` — Content catalog (posts + pages) and projections.
  - `server/comments/`, `server/sidebar/`, `server/feed/`,
    `server/search/`, `server/seo/`, `server/metrics/`, `server/music/`,
    `server/categories/`, `server/tags/`, `server/friends/`,
    `server/users/` — Domain services.
  - `server/images/` — Image storage dispatch, OG, calendar, thumbhash,
    font-asset, compression pipelines.
  - `server/markdown/` — MDX parser, formatter, rehype plugins,
    Mermaid, Shiki, TOC.
  - `server/email/` — SMTP sender + React Email templates.
  - `server/cache/`, `server/rate-limit.ts` — Redis-backed caches.
  - `server/install/`, `server/settings/` — Install gate state and
    per-section settings registry/snapshot.
  - `server/env.ts` — `@t3-oss/env-core` schema and exported constants.
  - `server/logger.ts` — Lightweight structured JSON logger.
- May import from `shared/` and other `server/`. Must not import from
  `client/` or `ui/`.

### `src/client/` — Browser Only

- Hooks, browser APIs, and the oRPC client (`@/client/api/client`).
  All HTTP calls go through `api.<domain>.<endpoint>(flatInput)` —
  the typed client is built from `typeof apiRouter`, so
  procedure signatures flow automatically. `unwrap()` translates
  oRPC's `ORPCError` rejections into the existing `ApiError` class.
  TanStack Query wrappers (`useApiQuery`, `useApiMutation`)
  live in `@/client/api/query`.
- Heavy widgets (e.g. `qrcode.react`) reach the bundle through
  React.lazy + Suspense from a UI component, not via top-level imports
  (see `bundle-dynamic-imports`).
- May import from `shared/` and other `client/`. Must not import any
  `server/` module or Node-only API (`node:fs`, `ioredis`, etc.).

### `src/ui/` — Pure-Props Components

- Each component receives explicit props. No reads from sessions, route
  params, request objects, or environment variables. State lives at the
  route module or the closest interactive parent.
- Three tiers, by intent:
  - **`ui/components/`** — shadcn/ui primitives (Base UI variant),
    flat by convention so `npx shadcn@latest add/diff` works out of
    the box (`components.json` aliases `components` / `ui` here).
    Subgrouping is reserved for special cases (none today). Public
    and admin trees both consume these primitives directly; one
    token cascade in `:root` (see `tailwind.css`) covers both.
  - **`ui/public/`** — public-site components, grouped by domain:
    - `chrome/` — site shell pieces (`Header`, `Footer`, `BaseLayout`,
      `PublicChrome`, `BrandLogo`, `NavigationSplash`,
      `ScrollTopButton`, `ThemeToggle`) plus the site-level fallback
      views (`ErrorView`, `NotWordPressView`).
    - `post/` — public reading experience (post / page detail bodies,
      list views, pagination, TOC, archives, categories) flat inside.
    - `comments/` — public comment thread + form.
    - `widgets/` — small isomorphic display primitives reused across
      public surfaces (`Image`, `Popup`, `QRDialog`,
      `use-image-loaded`).
    - Single-file domain leaves at the top of `ui/public/`:
      `Search.tsx`, `Sidebar.tsx`, `LikeActions.tsx`.
  - **`ui/admin/`** — admin panel, already grouped by domain
    (`categories/`, `comments/`, `editor/`, `friends/`, `images/`,
    `musics/`, `pages/`, `posts/`, `settings/`, `tags/`, `users/`,
    plus `auth/` for the login + install forms, `shared/` for
    cross-domain admin pieces, and `shell/` for `AdminShell`,
    `AdminScrollTopButton`, `AdminErrorFallback`).
- Cross-cutting modules sit at the top of `ui/` because they serve
  both public and admin:
  - `ui/pt/` — PortableText SSR renderer (`render.tsx`,
    `Footnotes.tsx`, `image-meta-context.tsx`) and the custom-block
    React components under `ui/pt/blocks/` (CodeBlock, BlockImage,
    MusicPlayer, Solution, Friends).
  - `ui/icons/` — Static-export icon library plus inline SVG pieces.
  - `ui/lib/` — UI-only utilities (e.g. `cn()`); shadcn's
    `aliases.lib` is pinned here.
- For raw HTML, use `dangerouslySetInnerHTML` directly on the host
  element. Do not recreate a generic `Html` wrapper.
- For conditional classNames, use `cn()` from `@/ui/lib/cn`. The helper
  composes `clsx` with a project-customised `tailwind-merge` that
  registers every custom `@theme` token name under its matching
  tailwind-merge group. Adding a new `--<namespace>-<name>` token in
  `tailwind.css` MUST be paired with an entry in `cn.ts`'s per-namespace
  token list — the contract is enforced by
  `tests/contract.tailwind-tokens.test.ts`. The full rationale (why we
  extend, why `leading` is intentionally omitted) lives in `cn.ts`'s
  module comment.
- Use `<Image />` from `@/ui/public/widgets/Image` for transformed remote
  images. Use named imports from `@/ui/icons` for inline SVG; never
  `<Icon name="..." />` string lookups (defeats static analysis).

### `src/shared/` — Isomorphic Only

- Side-effect-free modules safe in both bundles.
- Forbidden: Node built-ins (`node:*`), `ioredis`, `drizzle-orm`,
  DOM-only APIs (`window`, `document`), and direct `process.env` reads.
- Add a module here only when at least one server caller and one client
  caller already exist. Anything that needs `pg` / `ioredis` / `node:*`
  belongs in `server/`.
- See `src/shared/` for the authoritative list. Notable groupings:
  wire & primitives (`contracts`, `urls`, `safe-url`, `request`,
  `security`, `tools`, `formatter`);
  `toc`, `images`, `pagination`); per-domain DTOs (`categories`,
  `comments`, `friends`, `music`, `socials`, `tags`, `users`,
  `cache-types`, `catalog`); settings & blog config (`settings`,
  `blog-config`, `blog-config-types`).

## Path Aliases

- `@/*` → `./src/*`

Files under `public/` are served as-is at the root URL (`/logo.svg`,
`/favicon.ico`, …) — reference them by absolute URL in JSX / config,
not by a TypeScript import. There is no `~/*` alias.

Use aliases instead of relative paths. The only allowed relative imports:

- `src/routes.ts` → project code (must use `./...`, not `@/...`,
  because React Router reads the route manifest before Vite resolves
  aliases).
- `./+types/*` — React Router type codegen colocated with each route.
- `vite.config.ts` and config-only plugins use explicit `.ts`
  specifiers because Vite+'s ESM config loader does not resolve bare
  TS specifiers (`allowImportingTsExtensions` is enabled for this).

## Routing And Data

- Use React Router `loader` for render-time data and `action` for route
  form submissions.
- Use `redirect`, `data`, `Response`, and thrown responses for control
  flow.
- Keep auth and session reads in loaders/actions. UI receives plain DTO
  props.
- **Non-page requests** (API, feeds, sitemap, generated images) are
  served by Hono native routes mounted in `server.ts`, NOT by React
  Router resource routes.

## Content

### Posts (Postgres)

- Stored in `post` + `content`, edited at `/wp-admin/posts`, rendered with
  `<PortableTextBody>` (`/posts/:slug`).
- Frontmatter equivalents (slug, categories/tags, visibility flags) live in
  the `post` table. Public URLs use `slug`, not internal id.
- `@/server/catalog` serves the compiled body, headings, raw source, and
  listing fields. Custom block components live under `@/ui/pt/blocks/`.

### Pages (Postgres)

- Stored in `page` + `content`, edited at `/wp-admin/pages`, rendered with
  `<PortableTextBody>` (`/:slug` from the `page.slug` column).
- Production pages are edited in `/wp-admin/pages`. Historical disk MDX
  under `src/content/pages/` is not shipped in the SSR bundle and is only
  useful if your deployment still runs a bulk importer from `scripts/`.

### Listing rules

- `visible=false` posts are hidden from the public home and random-post widgets
  but stay in `/archives`, `/tags/:slug`, `/search/:keyword`, `sitemap.xml`,
  feeds, and category/tag listings and counts. Future-dated posts stay
  excluded until publish time.

### Page MDX → Postgres import (optional)

- One-shot MDX → `page` / `content` tooling, when needed, lives next to its
  entry script under `scripts/` (paths change between refactors — read the file
  header and inline help).
- Typical expectations: resolve image/music references, strip or toggle
  `<Friends />`, convert through a **narrow** mdast → PortableText path so
  unsupported constructs throw instead of dropping silently.
- Pure conversion logic may be covered by `tests/script.migrate-pages-mdx.test.ts`
  when that module is still wired in the tree.

### Taxonomies (categories, tags, friends)

- Postgres tables edited from `/wp-admin/{categories,tags,friends}`.
- MDX references categories and tags by `name`. The catalog throws on cold
  start if a category is missing and warns on a missing tag; keep admin names
  aligned with repo MDX.
- Deletion is blocked while a post still references the row — update MDX first.

### Slug derivation

- One canonical helper for every URL slug in the project lives at
  `@/server/slug.ts::deriveSlug(text)`. The pipeline is
  `pinyin-pro` → whitespace-collapse → `github-slugger`, with a
  post-pass that collapses runs of dashes and trims leading /
  trailing dashes, so the output always satisfies `SLUG_PATTERN`
  (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
- Server-only — `pinyin-pro` ships ~150KB of CJK lookup tables and
  must NOT reach the client bundle. The shared / client trees never
  import `@/server/slug`; admin forms send `slug?: string` and the
  service derives from the entity name / title when the field is
  blank.
- Every authoring surface follows the same contract: tag, category,
  page, and heading-anchor slugs all flow through `deriveSlug`. Page
  schema still permits `[._-]` separators in user-supplied slugs so
  legacy URLs like `archives.html` survive, but the derived value is
  always plain kebab-case ASCII.
- Heading anchors for DB-backed pages: SSR loaders pre-compute
  `collectHeadings(body, deriveSlug).map(h => h.slug)` and pass the
  list to `<PortableTextBody headingSlugs>`. The renderer consumes
  one slug per heading via a per-render cursor; with the prop absent
  (editor live-preview before the server round-trip) it falls back
  to a local `github-slugger` over the raw text. MDX posts stay on
  `rehype-slug` and produce byte-identical anchors for ASCII
  headings.

### Slug uniqueness — page ↔ post is global

- **Page slugs and post slugs share a single namespace.** Even
  though the public routes physically separate them
  (`/posts/:slug` vs `/:slug`), the catalog, OG image generator
  (`/images/og/:slug.png`), comment threading (keyed on
  permalink), and sitemap all key on the slug independent of the
  prefix. A page slug equal to a post slug (or to any post
  `alias[]` value) is a violation of the global invariant.
- **The three emitters in this namespace** are the DB `page` table (`slug`
  column), MDX post frontmatter `slug`, and MDX post `alias[]`.
- **Enforcement is split across two layers.** The DB-level
  `UNIQUE(slug)` on the `page` table and `findPageMetaBySlug` in
  `@/server/cms/pages/service` only catch page↔page collisions
  inside the `page` table. The cross-table page↔post fence lives
  in `@/server/catalog/catalog::validatePageSlugs`, which runs at
  catalog cold start and after every admin save. A colliding save
  succeeds at save time and surfaces as a 500 on the next
  catalog rebuild — keep this asymmetry in mind when changing
  the page-service or catalog code paths.
- **Adding a new slug emitter** (a future `note` collection, a
  redirect table, …) MUST be folded into either `postSlugs` or
  `validatePageSlugs` (depending on which side of the namespace it
  lives on). Otherwise the global invariant silently degrades and
  `getCatalog().getPost(slug) ?? getCatalog().getPage(slug)`
  starts returning the wrong row.

### Page draft preview

- `routes/page.detail.tsx` resolves a page through one of two
  branches and paints a red admin-only badge next to the title via
  `PageDetailBody`'s `draftMarker` prop:
  - **Catalog miss** (`page.published=false`, scheduled, or
    "never published") — anonymous visitors get 404 in every
    environment. Logged-in admins fall back to
    `loadPageDraftPreviewBySlug` (latest draft preferred over
    published) and the title shows red **【草稿】**.
  - **Catalog hit + `?draft=true`** — anonymous visitors and
    non-admin sessions ignore the query parameter and see the
    published body. Logged-in admins enter the draft-overlay
    branch:
    - newer draft exists → body swaps to the draft, title shows
      red **【未发布的草稿】**.
    - no newer draft (latest revision IS the published one) →
      body stays on the published revision, title shows red
      **【已发布的草稿】** (confirms parity).
- The marker discriminator is
  `'draft' | 'unpublished-draft' | 'published-draft' | null` and
  lives in `@/ui/public/post/PageDetailBody`. The single service
  function `loadPageDraftPreviewBySlug` returns
  `{ page, hasNewerDraft }`; the route picks the marker from
  `(meta.published, hasNewerDraft)` so the UI never has to know
  about the publication state machine.

### Page meta toggles

- The `page` table carries a small set of operator-facing booleans
  edited from the right sidebar of `/wp-admin/pages/edit/:id`
  (`MetaSidebar`'s 展示选项 card). Each one drives a render-time
  branch in `routes/page.detail.tsx`, **never** a body mutation, so
  the operator can flip it on/off without re-publishing the
  PortableText document.
  - `comments_enabled` — render the comment thread under the body.
  - `show_toc` — render the right-rail Table of Contents.
  - `show_friends` — append the global friends grid (same surface as optional
    `<Friends />` in post MDX) to the bottom
    of the body, before the Like button. The PortableText dialect
    deliberately has no `friends` block — flipping this toggle is
    the only way to surface the grid, so an editor can opt in /
    out without re-publishing the body.
- Adding a new toggle is a small, mechanical change that has to
  travel six layers in lockstep:
  1. `src/server/db/schema.ts` — column + comment.
  2. A drizzle migration directory under `drizzle/` with both
     `migration.sql` (`ALTER TABLE … ADD COLUMN IF NOT EXISTS …`)
     and a freshly-cloned `snapshot.json` (the old snapshot, with
     a new `entityType: 'columns'` entry inserted next to the
     existing toggles, a fresh `id`, and the previous id appended
     to `prevIds`).
  3. `src/server/cms/pages/projection.ts` (`toCmsPage` and
     `toAdminPageDto`).
  4. `src/server/cms/pages/service.ts` (`createPage` default,
     `updatePageMeta` fallback) and the matching Zod field in
     `src/server/cms/pages/schema.ts`.
  5. `src/shared/cms-pages.ts` (`AdminPageDto`,
     `UpsertPageMetaInput`) and `src/shared/catalog.ts`
     (`ClientPage` if the toggle has a public effect).
  6. `src/ui/admin/pages/MetaSidebar.tsx` (`PageMetaDraft`,
     `EMPTY_META_DRAFT`, `metaDraftFromPage`, plus a `<ToggleRow>`)
     and the matching `meta.<flag>` echo in
     `src/ui/admin/pages/PageEditorShell.tsx` (three call sites:
     create, edit-meta, publish).
- The `CreateDraftMeta` shape in
  `src/client/hooks/use-create-page-draft.ts` is a structural
  mirror of `PageMetaDraft` — adding a field requires updating
  both. The duplication is intentional (the `client` layer can't
  reach into `ui`); test fixtures (`tests/_helpers/catalog.ts`,
  `tests/service.cms-pages*.test.ts`) need the new default too.

### Images

- Owned by the Postgres `image` table; managed at `/wp-admin/images`.
  Bytes live in an S3-compatible bucket. The public URL is
  `<storage.publicBaseUrl>/<storagePath>`.
- The dispatcher (`@/server/images/storage`) is gated on the single
  `assets.storage.enabled` toggle in `setting('blog.assets')`:
  - **ON** — PUT/DELETE go through `@/server/images/s3-client`.
  - **OFF** (default for fresh installs) — PUT/DELETE return
    `ActionFailure(503)`. The library is read-only; the SSR enhancer
    still resolves historical rows against the saved `publicBaseUrl`.
    Toggling back on does not require re-pasting credentials.
- Every `image` row represents an S3 object. There is no `external`
  origin and no `image.source` discriminator.
- Uploads only happen through the admin UI: `/wp-admin/images` for
  generic assets (`images/yyyy/MM/<timestamp>.jpg`), and the inline
  upload affordances in `EditCategoryDialog` /
  `EditFriendDialog` for category covers (`images/categories/<slug>.jpg`)
  and friend posters (`images/links/<host>.jpg`), both locked to a
  1280×425 crop. The button reflects `storage.enabled` so operators
  see "S3 上传未开启" instead of discovering 503 by clicking through.
- `@/server/images/render-enhance` post-processes generated HTML for
  feeds and synchronously resolves cover thumbhashes by querying the
  `image` table through a process-level LRU cache.

### Music

- Owned by the Postgres `music` table; managed at `/wp-admin/musics`.
  Audio (`musics/<playerId>.mp3`) and 300×300 JPEG covers
  (`musics/<playerId>.jpg`) live in the same S3 bucket and share the
  `assets.storage.enabled` toggle.
- MDX references a row through a 16-character lowercase nanoid
  (`<MusicPlayer id="..." />`). The browser fetches metadata from
  `/api/actions/music/get?id=<playerId>`.
- The service layer is `@meting/core` netease-only; `(source,
sourceId)` is a unique key and `source` is reserved as varchar so
  additional providers can be added later without a migration. Lyrics
  live in `music.lyric` so the player never makes a second round trip.

### PortableText editor

- Pages and posts persist their body as PortableText (PT). The Zod
  dialect lives in `@/shared/pt/schema` (standard text /
  list / heading / blockquote + custom blocks `image`, `code`,
  `mathBlock`, `mermaid`, `horizontalRule`, `musicPlayer`,
  `solution`, `footnoteDefinition`, `table`). Sibling isomorphic
  modules — `@/shared/pt/bridge`, `@/shared/pt/semantics`,
  `@/shared/pt/footnote-merge` — round out the shared core. The
  friends grid is intentionally NOT a body block — it's a meta
  toggle on the `page` row (`page.show_friends`) rendered by
  `routes/page.detail.tsx` after the body. See
  `### Page meta toggles`.
- Server-only PT helpers live in `@/server/pt/*`:
  `@/server/pt/prerender` (Shiki / KaTeX / Mermaid pre-rendering)
  and `@/server/pt/canonicalize` (validate + prerender). These
  must never reach the client bundle.
- The PT ↔ ProseMirror bridge is `@/shared/pt/bridge` — single
  file by design. Standard blocks map onto Tiptap's built-in nodes;
  custom blocks ride a generic `blockCard` PM node so the bridge
  doesn't need an extension per type. Round-trip is contract-tested
  in `tests/contract.pt-bridge.test.ts`.
- SSR rendering goes through `@/ui/pt/render` (exported as
  `PortableTextBody`), which composes `@portabletext/react`'s
  component map with our custom-block React components from
  `@/ui/pt/blocks/*`. Heading anchor ids align with MDX post anchors
  for stable deep links.
- The admin Tiptap editor is `@/ui/admin/editor/PageBodyEditor`
  (shared by pages and posts). Sibling modules
  (`DraftConflictDialog`, `FootnoteEditorDialog`,
  `portable-text-diff`, `tiptap/`, `pickers/`) live alongside it.
  UX surface area lives in three layers, in this order:
  1. **Toolbar** (in `PageBodyEditor.tsx`): mouse-driven access to
     the image library, music picker, link, table, hr, undo/redo.
  2. **`tiptap/BubbleMenu`** + `tiptap/TableBubbleMenu`: floating
     inline-format menus. The first owns text selections (B/I/U +
     code + link popover + `mathInline` / `footnoteRef` editing
     panels); the second owns table selections (rows / columns /
     header / merge / split / delete). They are mutually exclusive —
     `BubbleMenu.shouldShow` hides itself inside tables.
  3. **`tiptap/SlashMenu`** (`/`-driven launcher): mounts via
     `@tiptap/suggestion`. The catalogue lives in
     `tiptap/slash-commands.ts`; pickers (image / music) dispatch
     `CustomEvent`s defined in `tiptap/editor-events.ts` so the
     suggestion plugin doesn't need direct refs into React state.
- The image block uses a React NodeView (`tiptap/ImageNodeView`) so
  alt + caption are editable inline and the operator can re-pick or
  delete the image without leaving the canvas.
- **Table dialect**: cells are restricted to inline spans only — no
  nested blocks, lists, code blocks, math blocks, or footnote refs.
  The only mark-def allowed in a cell is `link`. The bridge enforces
  this on PM → PT conversion. The slash-menu / toolbar shortcut
  inserts a 3×3 table with a header row by default.
- Floating popups in the editor anchor with `position: fixed` driven
  off the suggestion plugin's `clientRect` (slash menu) or Tiptap's
  built-in `BubbleMenu` positioner. Do **not** add `@floating-ui/*`
  as a direct dep — `@base-ui/react` already pulls it in
  transitively for shadcn primitives, and editor menus don't need a
  third positioning library.

## RSC Layering Rules

Enforced by code review and (where practical) lint and import-boundary
tests:

- `server/*` may import from `shared/*` and other `server/*`. May not
  import from `client/*` or `ui/*`.
- `client/*` and `ui/*` may import from `shared/*`, `ui/*`, and
  `client/*`. May not import any `server/*` module or any `.server.*`
  file.
- `shared/*` may import from `shared/*` only. Must run in both
  bundles without polyfills.
- `routes/*` may import from any layer. Components rendered by a route
  must accept plain props and must not reach back into `server/*`
  inside the JSX tree.
- The `*.server.ts` suffix is a redundant marker for files inside
  `src/server/` and required for any module living outside `src/server/`
  that must never reach the client (none should remain by design).
- Avoid barrel files (`index.ts` that just re-exports siblings) per
  `bundle-barrel-imports`.

The Vercel React performance Skill catalogues additional rules
reviewers cite during PR review: `server-no-shared-module-state`,
`server-cache-react`, `bundle-analyzable-paths`,
`bundle-dynamic-imports`, `rendering-resource-hints`, and `rerender-memo`.

## Component Rules

- Plain TSX with explicit props. No hidden reads from route params,
  sessions, request objects, or environment variables.
- Compose with children and slots, not boolean prop matrices
  (`vercel-composition-patterns/architecture-avoid-boolean-props`).
- Prefer compound components over render-prop callbacks for nested
  pieces of the same widget.
- Recursive components recurse by component name.
- React 19: do not introduce `forwardRef` for new components; refs
  flow through props.

## Client Interactivity

- All interactivity lives in React components/hooks under `@/client/`
  and `@/ui/`. `src/assets/scripts` is intentionally absent — there is
  no separate browser-script pipeline.
- Interactive components call resource URLs through the oRPC client
  (`api` from `@/client/api/client`). They must not import server modules
  (a type-only import to satisfy `RouterClient<ApiRouter>` typing is the
  one allowed exception, since `import type` erases at compile time).
- Avoid adding new client dependencies unless the interaction needs them.

### iOS auto-zoom contract

iOS Safari zooms the viewport in when the user focuses a form
control whose CSS `font-size` is below 16px. Bumping every input /
textarea to `font-size: 16px` would inflate the densities the
design system relies on — admin form rows pair with `<Button
size="sm">` (`h-9`), the comment composer trades density for
content, the public search chip sits inside the sidebar widget
grid. So instead of a typographic floor, every form control across
the project inherits an app-wide hook that temporarily disables
user-scaling on the viewport `<meta>` tag while any control is
focused and restores the previous value on blur.

- **Single source of truth**: `useIosNoZoomOnFocus()` lives in
  `@/client/hooks/use-ios-no-zoom` and is mounted **once** at the
  top of `src/root.tsx`'s default `App` component. The hook
  installs `focusin` / `focusout` listeners on `document`, so a
  single install covers every `INPUT` / `TEXTAREA` / `SELECT` on
  every page — public, admin, login split-screen, install
  wizard — without any per-form glue.
- **Do NOT re-install per-form.** A second `useIosNoZoomOnFocus()`
  call anywhere in the tree would race two listeners against the
  same `<meta>` rewrite and leak pinch-zoom in or out
  unpredictably. New form components, new admin domains, new
  marketing pages — they all just use `<Input>` / `<Textarea>` /
  `<Select>` and inherit the behaviour.
- **Detection is gated to iOS / iPadOS WebKit.** Other platforms
  no-op so pinch-zoom on the rest of the page (article cover
  images, code blocks, etc.) stays available.
- **Focus traversal keeps the lock.** While focus moves between
  form controls anywhere on the document, the viewport stays
  locked — restoring the meta tag mid-tab would let Safari re-zoom
  on every keystroke. Only when focus leaves form-control DOM
  entirely does the original meta value come back.

## Sessions, Env, And Security

- Sessions use Hono middleware (`server/http/session.ts`) which wraps
  React Router `createSessionStorage` with Redis persistence and a signed
  `__session` cookie. `SESSION_SECRET` required. The middleware populates
  `c.var.session` and commits `Set-Cookie` after the response is built.
- Server environment access goes through `@/server/env` (built on
  `@t3-oss/env-core` + Zod). When adding env vars, update the t3-env
  schema, `src/env.d.ts`, and `.env.example` together.
- The S3 toggle (`assets.storage.enabled`), credentials, bucket, asset
  CDN host, and upload limits live under `setting('blog.assets')` and
  are edited at `/wp-admin/settings/assets`. There are no
  `ASSET_HOST` / `ASSET_SCHEME` env vars; `assets.asset.host` /
  `assets.asset.scheme` is the same CDN host used by the image library
  and `<MusicPlayer>`.
- Use `zod` directly. Security helpers (CSRF, client-address parsing)
  live in `@/server/auth/*` and the isomorphic primitives in
  `@/shared/request`, `@/shared/security`.

## Configuration & Install Gate

- The single source of truth for runtime blog config is the `setting`
  table — **one JSONB row per settings section**, `scope='blog.<section>'`
  (`blog.general`, `blog.assets`, `blog.navigation`, `blog.socials`,
  `blog.content`, `blog.sidebar`, `blog.comments`, `blog.seo`,
  `blog.footer`, `blog.mail`, `blog.cache`). Splitting per section
  means a save to one section never reads or rewrites the JSONB of
  another, so concurrent admin tabs cannot race.
- Section ↔ DB scope ↔ Zod schema ↔ bundle key mapping lives in
  `@/server/settings/sections.ts`'s `SECTION_REGISTRY`.
- The in-memory composition is `BlogSettingsBundle`
  (`@/shared/blog-config`): one bucket per section, each typed
  independently. SSR call sites use `requireBlogSettingsSection('<key>')`;
  UI call sites use the matching per-section hook (`useSiteIdentity`,
  `useAssetsSettings`, `useNavigationSettings`, `useSocialsSettings`,
  `useContentSettings`, `useSidebarSettings`, `useCommentsSettings`,
  `useSeoSettings`, `useFooterSettings`, `useMailSettings`,
  `useCacheSettings`). Each hook has a strict variant (throws if the
  section is unseeded) and an `…Optional` variant for tolerant paths.
- **New UI components MUST NOT** reach for the aggregated
  `useBlogSettingsBundle()` / `useBlogSettingsBundleOptional()`.
  Reading a slice you do not need re-renders on every unrelated
  section save. Use the per-section hook.
- The install flow is split into two stages so the settings write is
  gated by an admin login:
  - **Stage 1** `/wp-admin/install.php` creates the first admin row
    and auto-logs the new user in. On success it redirects to stage 2.
  - **Stage 2** `/wp-admin/install/settings.php` persists `blog.general`
    and `blog.assets` from the form AND seeds the remaining 9 sections
    from `SECTION_REGISTRY[<section>].defaults`. 11 rows are written
    atomically so the very first public render after install can use
    the strict per-section hooks. The `blog.assets` row defaults to
    upload toggle OFF; the admin opts in later at
    `/wp-admin/settings/assets`. The route loader requires an
    authenticated admin session.
- `honoInstallGateMiddleware` (`@/server/http/install-gate.ts`) reads
  `getInstallState()` and routes:
  - no admin row → `/wp-admin/install.php`
  - admin present but `blog.general` and/or `blog.assets` missing →
    `/wp-admin/install/settings.php`
  - installed → through.
    Static assets, framework internals (`/__manifest`, …), and the
    install/login trio are exempt and drive their own cross-redirects via
    `ensureInstalledOrRedirect()` / `ensureNoAdminOrRedirect()` /
    `ensureNoSettingsOrRedirect()` so for any state exactly one helper
    throws (no redirect loops).
- Pre-existing deployments missing optional sections are backfilled
  lazily on next snapshot hydration through `loadSettingsFromDb()` and
  `upsertSetting`. The backfill is best-effort and swallows DB errors.
- Admin section saves go through `api.admin.settings.update` (oRPC
  procedure), which validates against `SECTION_REGISTRY[section].schema`
  and writes ONLY that one row. There is no aggregate "reset to defaults"
  action.

## API Layer (Hono + oRPC)

- **Base procedures** (`server/http/orpc-base.ts`) declare four flavours
  built off `os.$context<HandlerContext>()`: `publicProc`, `authedProc`,
  `adminProc`, `authorProc`. Each chains its own auth/role middleware
  via `.use(requireAuth)` / `.use(requireRole(role))`. The leaf
  procedure picks one of the four and inherits the guard automatically.
- **Procedures live alongside controllers**
  (`server/http/controllers/<domain>.controller.ts`). Each file builds
  one or more procedures with `procBase.input(zod).output(zod).handler(({input, context}) => …)`
  and exports a `<domain>Router` object grouping them. Business logic
  lives in `server/<domain>/service.ts`; the handler only orchestrates.
- **Zod DTOs** in `shared/contracts/_dtos.ts` are reused verbatim from
  the ts-rest era — each one paired with a compile-time
  `Equals<z.infer, TInterface>` parity assertion against the canonical
  `src/shared/*.ts` interface. Drift becomes a build error.
- **Router composition** (`server/http/api-router.ts`) groups the
  per-domain routers into a single `apiRouter` tree, exported as
  `ApiRouter`. The `admin: {…}` sub-tree mirrors the URL hierarchy.
- **Mount** (`server/http/app.ts`) wires one `RPCHandler` at `/rpc/*`
  with `csrfGuard` running upstream (CSRF lives on one layer; handlers
  never call `validateRequestCsrf` themselves). Per-procedure response
  headers (e.g. `Set-Cookie` for csrf rotation) ride through a mutable
  `responseHeaders: Headers` field on the context and are merged onto
  the final `Response` by the bridge.
- **Resource routers** (`server/http/resources/`) are native Hono
  routers for non-JSON output (RSS/Atom, sitemap.xml, OG images,
  calendars, avatars). Their RBAC needs come from
  `server/http/hono-rbac.ts::requireRoleMw` since they live outside
  the oRPC tree.
- **OpenAPI** (`/openapi.json` + `/docs`) is auto-generated from
  `apiRouter` via `@orpc/openapi`'s `OpenAPIGenerator` in development.

### Adding a new API endpoint (3 steps)

1. **DTO** — if the response/input needs a new Zod schema shared
   with the UI, add it to `shared/contracts/_dtos.ts` with a
   `_<name>Parity` assertion against the corresponding TS interface
   in `src/shared/*.ts`. Otherwise inline a `z.object({...})`
   alongside the procedure.
2. **Procedure** — append a procedure to the matching
   `server/http/controllers/<domain>.controller.ts`:
   `const create = adminProc.input(...).output(...).handler(({input,
context}) => …)`. Export it on the file's `<domain>Router` object.
3. **Compose** — if the controller is already wired in
   `server/http/api-router.ts` (most are), nothing else to do.
   For a brand-new domain, add one line under `apiRouter` /
   `apiRouter.admin`.

UI calls land on `api.<domain>.<resource>.<verb>(flatInput)` (e.g.
`api.admin.users.list({ offset: 0, limit: 20 })` — note the **single
flat input object**, no `{ body, query, params }` buckets) and
unwrap via `unwrap()` from `@/client/api/unwrap`. Service-side errors
are thrown as `ORPCError('CODE', { message })`; `unwrap()` bridges
them back to the existing `ApiError(message, status, issues)` shape
so UI consumers (toast handlers, error boundaries) work unchanged.
Use `.output(z.void())` for 204-like procedures; the RPC envelope
still emits a 200 with `null` payload, but the client receives
`undefined`.

## Permission Matrix

The API security policy is encoded in the base procedure each leaf
chose from `src/server/http/orpc-base.ts`. The audit surface is one
`grep`: `grep -rn "adminProc\|authorProc\|authedProc\|publicProc"
src/server/http/controllers/` reveals every procedure and its guard
in one pass.

| Base procedure | What it does                           | Use for                               |
| -------------- | -------------------------------------- | ------------------------------------- |
| `publicProc`   | No auth gate; `csrfGuard` on non-GET   | Anonymous reads + mutations with CSRF |
| `authedProc`   | `requireAuth` middleware + `csrfGuard` | Any logged-in user                    |
| `authorProc`   | `requireRole('author')` + `csrfGuard`  | Authors and admins                    |
| `adminProc`    | `requireRole('admin')` + `csrfGuard`   | Admins only                           |

The composed router lives at `src/server/http/api-router.ts`; the
sub-tree shape (`admin: { users: …, posts: … }`) mirrors the URL
hierarchy after the `/rpc/` prefix (`/rpc/admin/users/list`).
Smoke coverage for the four base procedures and the wire format
lives in `tests/server.http.orpc-smoke.test.ts`.

## Assets

- Vite emits generated assets to `build/client/assets`.
- The production build does not upload generated assets to S3 and does
  not rewrite asset URLs through a build-time CDN base.
- Docker builds run `npm run build` and copy local `build/` into the
  runtime image.
- Public files and hard-coded absolute URLs are served as authored.

## Formatting And Lint

- `.ts` / `.tsx` formatted with `oxfmt` and linted with `oxlint`.
- Comments inside Tailwind CSS files (`src/assets/styles/*.css`,
  especially `tailwind.css`) MUST stay minimal. The Lightning CSS
  pipeline through Rolldown has been observed to choke on heavy
  comment payloads inside `@theme` / `@utility` / `@layer` blocks.
  Rules:
  - One short ASCII line per region, only as a section header — never
    mid-rule, never above an individual declaration.
  - No special characters or punctuation. Use plain English or Chinese
    words and spaces only. The CSS pipeline is contractually allowed
    to misread anything else as live syntax.
  - Decision-log narrative belongs in commit messages, this file, or
    a TS/TSX consumer's comment — never in CSS.
- Git hooks are owned by Vite+. Committed hook scripts live in
  `.vite-hooks/*` (e.g. `.vite-hooks/pre-commit` → `vp staged`); the
  runtime wrapper `.vite-hooks/_/` is generated by `vp config` and is
  gitignored. The `staged` task list is declared in `vite.config.ts`.
  `npm install` runs `prepare` which calls `vp config`. Set
  `VITE_GIT_HOOKS=0` to skip hook installation (used by the Dockerfile).

## Editing Guidance — Defensive Constraints

These are landmines from past refactors. Do not reintroduce them.

- No `astro.config.ts`, `src/pages`, `.astro` route shells,
  `src/actions`, `src/middleware`, `src/layouts`, `src/services`,
  `src/hooks`, `src/db`, or `src/assets/scripts`. All folded into the
  four-layer architecture above.
- No `src/blog.config.ts`, `DEFAULT_SETTINGS`, `BlogConstants`, or
  per-section "重置为默认" reset action.
- No single monolithic `BlogConfigContext` / `<BlogConfigProvider>` on
  the public tree. `<BlogSettingsProvider>` nests one React context per
  section; subscribe with the per-section hook.
- No `data-admin-shell` data-attribute or selector that branches on it.
  Branding differences belong in component props, not in parallel CSS
  variable trees.
- No `src/lib/` parallel to `@/ui/lib`. The shadcn CLI is wired through
  `components.json`'s `aliases.lib = @/ui/lib`.
- No `@/ui/admin/shadcn/components/ui/` nesting. shadcn primitives live
  at `@/ui/components/`; admin domain UIs at `@/ui/admin/`.
- Keep server-only imports inside `src/server/` (or behind dynamic
  imports inside loaders/actions/resource routes if the call site must
  live elsewhere).
- Preserve public URLs, feed URLs, image endpoints, WordPress
  compatibility routes, and pagination routes unless explicitly asked
  to change them.
- When moving files, update imports and documentation in the same
  change.
- **Hono / oRPC defensive rules:**
  - Do not write business logic inside procedure handlers — they only
    orchestrate service calls.
  - Throw `ORPCError('CODE', { message })` from procedures (or services
    they invoke) for non-2xx flows. `onErrorHandler`
    (`server/http/errors.ts`) handles the rest. Service layers should
    not throw `HTTPException` (that was the Hono-direct path).
  - Do not bypass `apiRouter` to add ad-hoc Hono RPC routes. Non-JSON
    resource routes (RSS, sitemap, images) belong in
    `server/http/resources/`; everything else goes through the oRPC
    router.
  - Do not use raw `fetch('/rpc/...')` string拼接 in client code —
    always call `api.<domain>.<endpoint>(flatInput)` from
    `@/client/api/client`. The oRPC client handles serialization,
    multipart for Blob inputs, error normalization, and the
    `{ json: ... }` RPC envelope.
  - The old ts-rest three-bucket call shape (`{ body, query, params }`)
    is gone. Procedure inputs are a single flat object that the
    contract's `z.object({...})` validates.

## Git And Commits

- Do not create commits unless explicitly asked.
- Before staging or committing, inspect `git status --short` and avoid
  mixing unrelated user changes into the commit.
- Commit messages: semantic format `<type>: <summary>` or
  `<type>(<scope>): <summary>` (e.g. `feat`, `fix`, `docs`, `refactor`,
  `test`, `chore`). The separator is an ASCII colon followed by one
  space. Imperative, concise English summary. For multi-line messages,
  blank line after the subject; bullets focused on user-visible or
  reviewer-relevant changes.
- For code changes, run or report the relevant Vite+ validation before
  committing — normally `vp check`, `vp test run`, and `vp build`.

## Vite+, the Unified Toolchain

Vite+ wraps Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite
Task in a single global CLI called `vp`. Run `vp help` for the full
list and `vp <command> --help` for specifics.

| Command                     | Purpose                                                                |
| --------------------------- | ---------------------------------------------------------------------- |
| `vp install` (`vp i`)       | Install dependencies                                                   |
| `vp dev`                    | Run the development server                                             |
| `vp check`                  | Run format, lint, and TypeScript checks                                |
| `vp lint` / `vp fmt`        | Lint or format only                                                    |
| `vp test`                   | Run tests (`vp test run` for one-shot)                                 |
| `vp build`                  | Build for production                                                   |
| `vp preview`                | Preview the production build                                           |
| `vp run <script>`           | Run a `package.json` script (e.g. `vp run dev` for the orchestrator)   |
| `vp dlx <bin>`              | Execute a package binary without installing it                         |
| `vp dlx vite-node <script>` | Run a TS script with Vite path aliases and `import.meta.env` populated |

Dependencies: use `vp add` / `vp remove` / `vp update`. Vite+ detects
the active package manager from `packageManager` in `package.json`.

### Pitfalls

- Do not run pnpm, npm, or Yarn directly.
- `vp dev` / `vp build` / `vp test` always run the Vite+ tool, never a
  `package.json` script of the same name. Use `vp run <script>` for
  custom scripts (`vp run dev` starts the orchestrator that runs the
  dev server alongside watchers).
- No `vp vitest` / `vp oxlint` subcommands; use `vp test` and `vp lint`.
- Do not install Vitest, Oxlint, Oxfmt, or tsdown directly — Vite+
  pins them.
- Import test utilities from `vite-plus/test`, not `vitest` or `vite`.
- `vp lint --type-aware` works out of the box; do not install
  `oxlint-tsgolint`.

### CI Integration

For GitHub Actions, prefer
[`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp):

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```
