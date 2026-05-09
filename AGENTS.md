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
- **Out-of-scope topics** (Drizzle migrations, Fumadocs MDX wiring,
  Vite+ tooling) fall back to this document and upstream library docs.

## Stack

- React Router 7 Framework Mode with SSR. `react-router.config.ts` keeps
  `appDirectory` at `src` and enables `future.v8_middleware`.
- Vite (via Vite+) is the build system. `vite.config.ts` wires React
  Router, Fumadocs MDX, binary asset imports, path aliases, and dev
  server settings.
- Fumadocs MDX compiles `src/content/posts` and `src/content/pages`.
  Categories, tags, and friend links live in Postgres and are edited
  through `/wp-admin/{categories,tags,friends}`.
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
├── content/          # Fumadocs collections (posts, pages).
├── assets/           # Static assets (icon SVGs, fonts, styles).
├── env.d.ts
├── react-router.d.ts
├── routes.ts         # Route manifest (URL → route module).
└── root.tsx          # Document shell. Owns global UI.
```

### `src/routes/` — Orchestration Only

- `*.tsx` are page route modules with `loader` / `action` / `meta` /
  default component.
- `*.ts` are resource routes (feeds, sitemap, generated images, API
  endpoints).
- Internal client APIs live as resource routes under
  `src/routes/api/actions/<domain>.<name>.ts` and serve
  `/api/actions/<domain>/<name>`. They export `loader` (GET) or `action`
  (POST/PATCH/DELETE) only — never a default component.
- Route modules orchestrate: read session/context at the perimeter, call
  into `server/`, project DTOs through `shared/`, render with `ui/`.
  No DB queries, Redis access, or markdown parsing inline.
- Public URLs and route module physical paths must stay stable —
  React Router derives stable route IDs from the file path.

### `src/server/` — SSR Only

- Sub-areas (each owns its loader, schema, and helpers):
  - `server/db/` — Drizzle pool, schema, query helpers, migrations.
  - `server/http/` + `server/route-helpers/` — Resource-route perimeter
    (`runApi`, `defineApiAction`, `ok`, `fail`), cache-header profiles,
    common response helpers.
  - `server/middleware/` — React Router root middleware (request
    context population, install gating, WordPress probe interception).
  - `server/auth/` + `server/session.ts` — Cookie session, CSRF,
    request context, login flow. `tests/contract.cookie.test.ts` treats
    these file paths as a contract; keep them in sync.
  - `server/catalog/` — Fumadocs-backed content catalog and projections.
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

- Hooks, `useApiFetcher`, the `API_ACTIONS` manifest + types.
- Heavy widgets (e.g. `qrcode.react`) reach the bundle through
  React.lazy + Suspense from a UI component, not via top-level imports
  (see `bundle-dynamic-imports`).
- May import from `shared/` and other `client/`. Must not import any
  `server/` module or Node-only API (`node:fs`, `ioredis`, etc.).

### `src/ui/` — Pure-Props Components

- Each component receives explicit props. No reads from sessions, route
  params, request objects, or environment variables. State lives at the
  route module or the closest interactive parent.
- Sub-areas:
  - `ui/primitives/` — Header, Footer, Image, Tooltip, Popup,
    QRDialog, ScrollTopButton.
  - `ui/components/ui/` — shadcn/ui primitives (Base UI variant). The
    layout matches `components.json` so `npx shadcn@latest add/diff`
    works out of the box. Public and admin trees both consume these
    primitives directly; the public site and the admin shell share a
    single token cascade defined once at `:root` in `tailwind.css`.
  - `ui/post/`, `ui/pagination/`, `ui/toc/`, `ui/sidebar/`,
    `ui/search/`, `ui/like/`, `ui/comments/`, `ui/admin/` — Domain UIs.
  - `ui/mdx/` — MDX-only React renderers (CodeBlock, MdxImg,
    MusicPlayer, Solution, Friends).
  - `ui/icons/` — Static-export icon library plus inline SVG pieces.
  - `ui/lib/` — UI-only utilities (e.g. `cn()`).
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
- Use `<Image />` from `@/ui/primitives/Image` for transformed remote
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
  wire & primitives (`api-actions`, `api-envelope`, `api-types`,
  `urls`, `safe-url`, `request`, `security`, `tools`, `formatter`,
  `toc`, `images`, `pagination`); per-domain DTOs (`categories`,
  `comments`, `friends`, `music`, `socials`, `tags`, `users`,
  `cache-types`, `catalog`); settings & blog config (`settings`,
  `blog-config`, `blog-config-types`).

## Path Aliases

- `@/*` → `./src/*`
- `~/*` → `./public/*`
- `#source/*` → `./.source/*` (Fumadocs-generated content)

Use aliases instead of relative paths. The only allowed relative imports:

- `src/routes.ts` → project code (must use `./...`, not `@/...`,
  because React Router reads the route manifest before Vite resolves
  aliases).
- `./+types/*` — React Router type codegen colocated with each route.
- `vite.config.ts` ↔ `source.config.ts` and config-only markdown
  plugins inside `source.config.ts`, which use explicit `.ts`
  specifiers because Vite+'s ESM config loader does not resolve bare
  TS specifiers (`allowImportingTsExtensions` is enabled for this).

## Routing And Data

- Use React Router `loader` for render-time data and `action` for route
  form submissions.
- Use `redirect`, `data`, `Response`, and thrown responses for control
  flow.
- Keep auth and session reads in loaders/actions. UI receives plain DTO
  props.

## Content

- Fumadocs collections are declared in `source.config.ts`. Posts in
  `src/content/posts/**/*.mdx`; pages in `src/content/pages/**/*.mdx`.
  No `astro:content`.
- URLs use MDX frontmatter `slug`, not physical filenames. Posts render
  at `/posts/:slug`; pages render at `/:slug`.
- The catalog (`@/server/catalog`) returns compiled MDX components
  through `body`, headings, raw source, and structured data. Custom MDX
  components live under `@/ui/mdx`; preserve math, Mermaid, heading
  slug, external link, title figure, and Shiki behavior via
  `source.config.ts`.
- `visible=false` posts are hidden from the public home and random-post
  widgets but are intentionally included in `/archives`, `/tags/:slug`,
  `/search/:keyword`, `sitemap.xml`, all RSS/Atom feeds, category
  listing pages, and category/tag counts. Future-dated scheduled posts
  remain excluded from those listings and counts.

### Migrating MDX pages into the DB

- The static pages under `src/content/pages/*.mdx` (about, guestbook,
  links, …) historically render through the Fumadocs MDX pipeline.
  Once the page editor is preferred, the one-shot script
  `scripts/migrate-mdx-pages.ts` walks every MDX page and writes it
  into the `page` + `content` tables via the same `createPage` +
  `publishLatest` service paths the admin UI uses.
- Run it with `vp dlx vite-node --env-file=.env scripts/migrate-mdx-pages.ts`
  for a dry run (default — no DB writes), and `--apply` to actually
  write. Add `--force` to skip the "slug already in `page` table"
  idempotency guard (the script still won't update an existing row;
  `--force` only opts a known slug back into the dry-run preview).
- Resource handling: cover URL + every inline `![alt](url)` go through
  `resolveSrcToStoragePath` + `findImageByStoragePath`. A hit fills
  the saved PortableText image block with `storagePath` / width /
  height / thumbhash and the cache-busted public URL; a miss leaves
  the bare URL on the block and surfaces in the per-page report so
  the operator can backfill the row in `/wp-admin/images`. Every
  `<MusicPlayer id="…">` is sanity-checked against `findMusicByPlayerId`
  — missing rows log a warning but don't abort (the runtime resolver
  handles unknown ids gracefully).
- `<Friends />` auto-toggle: when the migration script's
  `stripFriendsTag` pass detects a `<Friends />` JSX tag in the raw
  MDX it removes the tag from the source AND pre-toggles
  `page.show_friends=true` on the inserted row so the meta switch
  reproduces the original visual outcome. The PortableText body
  itself never carries a `friends` block (that block type was
  retired together with the meta toggle). The
  `migrate.report.show_friends_auto` warning surfaces every page
  the script touched so the operator can confirm the toggle in
  `/wp-admin/pages` afterward.
- The script never deletes the source MDX. The catalog already
  prefers DB rows over MDX of the same slug
  (`buildDbPage(...).filter((p) => !dbPageSlugs.has(p.slug))` in
  `@/server/catalog/catalog`), so a successful migration is
  reversible by deleting the `page` row from `/wp-admin/pages` —
  the MDX takes over again.
- The mdast → PortableText converter at
  `@/server/cms/pages/migrate-mdx` is intentionally narrow: it
  handles paragraphs, headings (h1-h4), lists (one level of
  nesting), blockquotes, images, links, decorators, and the
  `<MusicPlayer>` JSX-shaped HTML. Anything richer (fenced code
  blocks, math, mermaid, tables, footnotes, custom Solution
  blocks, multi-level lists, **`<Friends />`**) throws so a future
  MDX page that grows a richer construct cannot silently lose
  content. The `<Friends />` strip happens upstream in the
  migration script, so by the time the converter runs no friends
  JSX survives the input.
  Extending the converter is a localised change in that one file
  (and one round of tests in `tests/service.cms-pages-migrate-mdx.test.ts`).

### Taxonomies (categories, tags, friends)

- Stored in the `category` / `tag` / `friend` Postgres tables, edited
  from `/wp-admin/{categories,tags,friends}`. No Fumadocs meta
  collection for taxonomies.
- MDX frontmatter references categories and tags by `name`, so admin
  renames must stay in sync with author edits in MDX. The catalog
  throws on cold start when a post references a missing category and
  warns when it references a missing tag.
- Deletion is blocked while any post still references the row — the
  admin must change the MDX frontmatter first.

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
  to a local `github-slugger` over the raw text. MDX pages stay on
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
- **The four emitters in this namespace** are the DB `page` table
  (`slug` column), MDX page frontmatter
  (`src/content/pages/**/*.mdx` `slug`), MDX post frontmatter
  (`src/content/posts/**/*.mdx` `slug`), and MDX post `alias[]`.
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

### Page meta toggles

- The `page` table carries a small set of operator-facing booleans
  edited from the right sidebar of `/wp-admin/pages/edit/:id`
  (`MetaSidebar`'s 展示选项 card). Each one drives a render-time
  branch in `routes/page.detail.tsx`, **never** a body mutation, so
  the operator can flip it on/off without re-publishing the
  PortableText document.
  - `comments_enabled` — render the comment thread under the body.
  - `show_toc` — render the right-rail Table of Contents.
  - `show_friends` — append the global friends grid (the same one
    the legacy `<Friends />` MDX component renders) to the bottom
    of the body, before the Like button. MDX-sourced pages always
    read `false` here (`buildPage` in `@/server/catalog/catalog`
    forces it) because they still embed `<Friends />` inline; the
    grid is rendered by the body's React component, not by the
    meta switch. The migration script strips `<Friends />` from
    the source and pre-toggles `show_friends=true` on the inserted
    DB row so DB-backed pages reproduce the same visual outcome
    without a body-side `friends` block (the PortableText dialect
    no longer carries one).
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
  - **ON** — PUT/DELETE go through `@/server/images/s3-client` (the
    AWS SDK is loaded lazily so URL-only paths don't pull it in).
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
  dialect lives in `@/shared/portable-text` (standard text /
  list / heading / blockquote + custom blocks `image`, `code`,
  `mathBlock`, `mermaid`, `horizontalRule`, `musicPlayer`,
  `solution`, `footnoteDefinition`, `table`). The friends grid is
  intentionally NOT a body block — it's a meta toggle on the
  `page` row (`page.show_friends`) rendered by
  `routes/page.detail.tsx` after the body. See
  `### Page meta toggles`.
- The PT ↔ ProseMirror bridge is `@/shared/pt-bridge` — single
  file by design. Standard blocks map onto Tiptap's built-in nodes;
  custom blocks ride a generic `blockCard` PM node so the bridge
  doesn't need an extension per type. Round-trip is contract-tested
  in `tests/contract.pt-bridge.test.ts`.
- SSR rendering goes through `@/ui/portable-text/PortableTextBody`,
  which composes `@portabletext/react`'s component map with our
  custom-block React components from `@/ui/mdx/*`. Heading anchor
  ids match the MDX path so deep links survive the migration.
- The admin Tiptap editor is `@/ui/admin/pages/PageBodyEditor`. UX
  surface area lives in three layers, in this order:
  1. **Toolbar** (in `PageBodyEditor.tsx`): mouse-driven access to
     the image library, music picker, link, table, hr, undo/redo,
     plus the drag-handle on/off toggle.
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
- Top-level block drag-and-drop is hand-rolled on dnd-kit
  (`tiptap/drag-handle-plugin.ts` + `tiptap/DragHandle.tsx`). Limit:
  reorder at depth 1 only — items inside lists / tables stay where
  they are because dropping them between top-level paragraphs would
  corrupt the surrounding container.
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
- Interactive components call resource URLs through `API_ACTIONS`
  (`@/client/api/actions`) and `useApiFetcher` (`@/client/api/fetcher`).
  They must not import server modules.
- Avoid adding new client dependencies unless the interaction needs them.

## Sessions, Env, And Security

- Sessions use React Router `createSessionStorage` with Redis
  persistence and a signed `__session` cookie. `SESSION_SECRET`
  required.
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
- `installGateMiddleware` (`@/server/middleware/install-gate`) reads
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
- Admin section saves go through `API_ACTIONS.admin.updateSettings`,
  which validates against `SECTION_REGISTRY[section].schema` and writes
  ONLY that one row. There is no aggregate "reset to defaults" action.

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
  at `@/ui/components/ui/`; admin domain UIs at `@/ui/admin/`.
- Keep server-only imports inside `src/server/` (or behind dynamic
  imports inside loaders/actions/resource routes if the call site must
  live elsewhere).
- Preserve public URLs, feed URLs, image endpoints, WordPress
  compatibility routes, and pagination routes unless explicitly asked
  to change them.
- When moving files, update imports and documentation in the same
  change.

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
