# AGENTS.md

Repository conventions for AI agents and contributors. Read this before
authoring routes, content loaders, templates, React components, or server
code.

This file is the **single source of truth** for project conventions.
`CLAUDE.md` is a `git`-tracked symbolic link to `AGENTS.md` (`ln -s
AGENTS.md CLAUDE.md`); never edit it separately and never replace it
with a divergent copy. When a Claude Code session looks for `CLAUDE.md`
it transparently reads this same file.

## Skills Are the Baseline

The conventions below are calibrated against the agent Skills shipped
under `.claude/skills/` (Claude Code) and `.agents/skills/` (Cursor /
generic agent runtimes). The two trees are kept in sync via
`skills-lock.json`; do not edit one without mirroring the change in the
other.

| Skill                         | When the agent must read it                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `react-router-framework-mode` | Adding routes, loaders, actions, forms, navigation, error boundaries, sessions, or touching `react-router.config.ts`. |
| `vercel-react-best-practices` | Writing or refactoring any React/SSR code. The 70 numbered rules are the project's performance baseline.              |
| `vercel-composition-patterns` | Designing new components, refactoring boolean-prop matrices, or building compound components / context providers.     |
| `shadcn`                      | Adding, updating, debugging, or styling shadcn/ui components, switching presets, or working with `components.json`.   |
| `tailwind-design-system`      | Authoring CSS tokens, design-system primitives, or any Tailwind v4 `@theme` change.                                   |
| `web-design-guidelines`       | Reviewing UI for accessibility, UX, and Web Interface Guidelines compliance.                                          |

Operating rules:

- **Read before authoring.** When a task triggers one of the Skills above
  (per its `description` frontmatter), open the SKILL.md and any
  referenced rule files _before_ writing code. Skills are the
  authoritative source for the conventions they cover.
- **Skills win on conflict.** If anything in this document contradicts a
  Skill rule, the Skill wins. Open a PR that fixes this document rather
  than silently re-introducing the older rule.
- **Quote the rule id in PR review.** For Vercel rule sets the IDs are
  stable (e.g. `bundle-barrel-imports`,
  `architecture-avoid-boolean-props`, `server-no-shared-module-state`).
  Reviewers cite the id so the rationale is reproducible.
- **Out-of-scope topics.** When a task is outside every installed Skill
  (e.g. Drizzle migrations, Fumadocs MDX wiring, Vite+ tooling), fall
  back to this document and the upstream library docs.

## Stack

- React Router 7 Framework Mode with SSR enabled. `react-router.config.ts`
  keeps `appDirectory` at `src` and enables `future.v8_middleware`.
- Vite is the build system. `vite.config.ts` wires React Router, Fumadocs
  MDX, binary asset imports, path aliases, and dev server settings.
- Fumadocs MDX compiles `src/content/posts` and `src/content/pages`;
  meta data lives in `src/content/metas/*.yaml` and is configured from
  `source.config.ts`.
- React 19 is the view layer. Route modules and components are TSX/TS
  only; there are no `.astro`, `astro:*`, or `@astrojs/*` runtime modules.
- Postgres stores comments, users, likes, and counters. Redis backs
  sessions, rate limits, avatars, and generated-image caches.

## Architecture

The codebase is organised as four cooperating layers under `src/`. The
goal is high cohesion within each layer and a one-way import graph
between them, so the server bundle and the client bundle can be reasoned
about independently.

```
src/
├── routes/           # Pure orchestration: loader / action / meta / component.
├── server/           # SSR-only logic. *.server.ts files, DB, Redis,
│                     # session, mail, cache, domain services.
├── client/           # Browser-side logic. Hooks, fetchers, browser APIs.
│                     # Heavy third-party widgets (e.g. `qrcode.react`)
│                     # are imported lazily from `src/ui/` via React.lazy.
├── ui/               # Pure-props React components. No server imports,
│                     # no session reads, no environment access.
├── shared/           # Truly isomorphic modules. Pure utilities that are
│                     # safe to evaluate in both server and client bundles.
├── content/          # Fumadocs collections (posts, pages, metas).
├── assets/           # Static assets (icon SVGs, fonts, styles).
├── blog.config.ts    # Static site configuration consumed by every layer.
├── env.d.ts          # Vite-side ambient typings.
├── react-router.d.ts # React Router framework-mode ambient typings.
├── routes.ts         # Route manifest (URL → route module).
└── root.tsx          # The single document shell. Owns global UI.
```

### `src/routes/` — Orchestration Only

- `src/routes/**/*.tsx` are page route modules with `loader`, `action`,
  `meta`, and default components as needed.
- `src/routes/**/*.ts` are resource routes such as feeds, sitemap,
  generated images, and API/action endpoints.
- Internal client APIs (comment, like, avatar, admin comment, …) live as
  Resource Routes under `src/routes/api/actions/<domain>.<name>.ts`.
  They export only `loader` (GET) or `action` (POST/PATCH/DELETE) and
  never a default React component. URL paths follow
  `/api/actions/<domain>/<name>`.
- Route modules orchestrate: read session/context from the perimeter,
  call into `server/`, project DTOs through `shared/`, and render with
  `ui/`. They should not contain DB queries, Redis access, or markdown
  parsing inline.
- Public URLs and route module physical paths must stay stable. React
  Router derives stable route IDs from the file path and breaking those
  IDs invalidates serialized links and bookmarks.

### `src/server/` — SSR Only

- Every file is server-only. The historical `*.server.ts` suffix is kept
  as a redundant marker so editors and bundlers can still reject
  accidental client imports, but the canonical signal is the directory.
- Sub-areas:
  - `server/db/` — Drizzle pool, schema, query helpers, migrations.
  - `server/http/` — Resource-route perimeter (`runApi`,
    `defineApiAction`, `ok`, `fail`), cache-header profiles, common
    response helpers, WordPress decoy gate.
  - `server/auth/*` (or, if merged in a follow-up, `server/session.ts`)
    — Cookie session, CSRF, request-context provider, login flow, form
    adapters. Tests treat the file path as a contract (see
    `tests/contract.cookie.test.ts`); keep them in sync.
  - `server/catalog/` — Fumadocs-backed content catalog and projections.
  - `server/comments/`, `server/sidebar/`, `server/feed/`,
    `server/search/`, `server/seo/`, `server/metrics/` — Domain
    services. Each domain owns its loader, schema, and helpers.
  - `server/images/` — OG, calendar, thumbhash, font-asset, compression
    pipelines.
  - `server/markdown/` — MDX parser, formatter, rehype plugins, Mermaid,
    Shiki, TOC.
  - `server/email/` — SMTP sender + React Email templates.
  - `server/cache/`, `server/rate-limit.ts` — Redis-backed caches and
    counters.
  - `server/env.ts` — `@t3-oss/env-core` schema and exported constants.
  - `server/logger.ts` — Lightweight structured JSON logger.
- Server modules can import from `shared/` and from other `server/`
  files. They must not import from `client/` or `ui/`.

### `src/client/` — Browser Only

- Houses interactive code that runs in the browser bundle. Hooks,
  `useApiFetcher`, and the `API_ACTIONS` manifest + types.
- Heavy third-party widgets (e.g. `qrcode.react` for QR rendering) are
  not vendored here; the consuming component reaches for them through
  React.lazy + Suspense so they only ship when actually used (see
  `bundle-dynamic-imports`).
- Heavy first-party helpers must likewise be reachable through dynamic
  `import()` from a React component, not via top-level imports.
- Client modules can import from `shared/` and other `client/` files.
  They must not import any `*.server.ts`/`server/*` modules or any
  Node-only API (`node:fs`, `ioredis`, etc.).

### `src/ui/` — Pure-Props Components

- Reusable React components. Each component receives explicit props
  and does not read sessions, route params, request objects, or
  environment variables. State is owned by the route module or by the
  closest interactive parent component.
- Sub-areas:
  - `ui/primitives/` — Header, Footer, Image, Tooltip, Popup,
    QRDialog, ScrollTopButton.
  - `ui/post/`, `ui/pagination/`, `ui/toc/`, `ui/sidebar/`,
    `ui/search/`, `ui/like/`, `ui/comments/`, `ui/admin/` — Domain UIs.
  - `ui/mdx/` — MDX-only React renderers (CodeBlock, MdxImg,
    MusicPlayer, Solution, Friends).
  - `ui/icons/` — Static-export icon library plus the inline SVG
    pieces.
- For raw HTML, use `dangerouslySetInnerHTML` directly on the host
  element. Do not recreate a generic `Html` wrapper component.
- For conditional / merged Tailwind classNames inside a component,
  call `twMerge(clsx(...))` directly (`clsx` from `clsx`, `twMerge`
  from `tailwind-merge`). The project intentionally has no shared
  `cn()` re-export so each call site is self-contained and the
  bundler can analyse Tailwind class strings statically.
- MDX-rendered HTML inside post/page bodies, comment bodies, and
  category-description previews (all `<div className="prose-host …">`)
  is styled by lightweight per-tag wrappers under `src/ui/mdx/` —
  `prose.tsx` covers `h1..h6`, `p`, `a`, `ol`, `ul`, `li`, `hr`,
  `code` (inline), `blockquote`, `sup`, `center`, and `table.tsx`
  covers `table`, `thead`, `tbody`, `tr`, `th`, `td`, `caption`.
  These are wired into MDX through the `MDXComponents` map in
  `src/ui/mdx/MdxContent.tsx`. Add a new wrapper there before
  reaching for a `.prose-host <tag>` rule in `globals.css`. The
  `.prose-host` cascade in `globals.css` is intentionally kept tiny
  and only covers what JSX cannot reach: `<a><img>` zoom cursor.
  Everything else (Shiki dual-theme `<pre class="shiki">` colour
  binding, medium-zoom portal nodes) lives in its own scope in the
  same `@layer components` block.
- `@layer components` only allows three scope-string selectors:
  `.prose-host`, `pre.shiki`, and `.medium-zoom-overlay`. Adding a
  fourth requires a comment in `globals.css` (and a note in the PR
  description) explaining why a React component cannot own the rule.
  `.toc-scrollbar` stays in `@layer utilities` as an opt-in utility
  and is exempt from this cap.
- Comment bodies are compiled to MDX through
  `@/server/markdown/runtime` (the `comment` profile) and rendered by
  `<CommentBody>` inside a `.prose-host` wrapper. They share
  `postMdxComponents` with post bodies, so per-tag styling in
  `src/ui/mdx/{prose,table}.tsx` covers them automatically. There is
  no longer a `.comment-content` cascade in `globals.css`. The
  `parseContent()` in `@/server/markdown/parser` compiles through the same
  `@fumadocs/mdx-remote` stack as comments (`compileMarkdown` with the
  `email` profile: CommonMark `format: 'md'`, no heading slug icons), then
  `executeMdxSync` + `renderToStaticMarkup` to produce HTML for email
  templates only (SMTP needs a string).
- Use `<Image />` from `@/ui/primitives/Image` for transformed remote
  images. Use named imports from `@/ui/icons` for inline SVG instead of
  string-based `<Icon name="..." />` lookups (string lookups defeat the
  bundler's static analysis — see Vercel `bundle-analyzable-paths` and
  the shadcn "Pass icons as objects, not string keys" rule).

### `src/shared/` — Isomorphic Only

- Strictly isomorphic, side-effect-free modules that the server bundle
  _and_ the client bundle can both pull in.
- Forbidden inside `shared/`: Node built-ins, `ioredis`,
  `drizzle-orm`, DOM-only APIs (`window`, `document`), and anything
  that reads `process.env` directly.
- Currently includes: `urls`, `safe-url`, `security`, `tools`,
  `request`, `api-envelope`, `image-url`, `domain-errors`, `formatter`
  (date helpers used by both SSR and client islands), and `toc`
  (heading-tree utilities reused by `@/server/markdown` and
  `@/ui/toc`). Add new modules here only when at least one server
  caller and one client caller already exist.

## Path Aliases

- `@/*` → `./src/*`
- `~/*` → `./public/*`
- `#source/*` → `./.source/*` (Fumadocs-generated content)

Use aliases instead of relative paths. The only allowed relative imports
are:

- `./+types/*` — React Router type codegen colocated with each route
  module.
- `vite.config.ts` ↔ `source.config.ts`, which import each other with an
  explicit `.ts` extension because Vite+'s ESM config loader does not
  resolve bare TS specifiers (`allowImportingTsExtensions` is enabled
  in `tsconfig.json` for this reason). `source.config.ts` may also use
  explicit relative `.ts` imports for config-only markdown plugins that
  must run during MDX compilation (currently the Mermaid rehype plugin
  and the cached Shiki rehype-code wrapper).

## Routing And Data

- Use React Router `loader` for render-time data and `action` for route
  form submissions.
- Use `redirect`, `data`, `Response`, and thrown responses instead of
  legacy Astro redirects, rewrites, response mutation, or actions.
- Keep admin authentication and session reads in loaders/actions. UI
  components should receive plain DTO props and should not import
  session or database code.
- Resource routes replace former `src/pages/**/*.ts` endpoints for
  feeds, sitemap, Open Graph images, calendar images, and avatar
  images.

## Content

- Do not use `astro:content`. Fumadocs collections are declared in
  `source.config.ts`.
- Posts stay in `src/content/posts/**/*.mdx`; pages stay in
  `src/content/pages/**/*.mdx`.
- Meta collections are YAML files in `src/content/metas`:
  `categories.yaml`, `tags.yaml`, and `friends.yaml`.
- URLs are based on MDX frontmatter `slug`, not physical filenames.
  Posts render at `/posts/:slug`; pages render at `/:slug`.
- `visible=false` posts are hidden from the public home listing and
  random post widgets, but they are intentionally included in
  `/archives`, `/tags/:slug`, `/search/:keyword`, `sitemap.xml`, all
  RSS/Atom feeds, category listing pages (`/cats/:slug`), category
  counts on `/categories`, and tag counts. Future-dated scheduled posts
  remain excluded from those public archives/tag/search/feed/sitemap
  listings and counts.
- The catalog (`@/server/catalog`) returns compiled MDX components
  through `body`, headings, raw source, and structured data. Do not
  reintroduce Astro `render()` semantics.
- Custom MDX components live under `@/ui/mdx`; preserve existing math,
  Mermaid, heading slug, external link, title figure, and Shiki
  behavior via `source.config.ts`.

## RSC Layering Rules

These rules are enforced by code review (and, where practical, by lint
rules and import-boundary tests):

- `server/*` may import from `shared/*` and other `server/*` modules. It
  may not import from `client/*` or `ui/*`.
- `client/*` and `ui/*` may import from `shared/*`, `ui/*`, and
  `client/*`. They may not import from any `server/*` module or any
  file with a `.server.*` suffix.
- `shared/*` may import from `shared/*` only. Modules here must run in
  both the server bundle and the client bundle without polyfills.
- `routes/*` may import from `server/*`, `client/*`, `ui/*`, and
  `shared/*`. Components rendered by a route must accept plain props;
  they should not reach back into `server/*` from inside the JSX tree.
- `*.server.ts` is a redundant marker for files inside `src/server/`
  and is required for any module that lives outside `src/server/` but
  must never reach the client (none should remain by design).
- Avoid barrel files (`index.ts` that just re-exports its siblings) per
  Vercel's `bundle-barrel-imports`. Import directly from the file that
  defines the symbol.

The Vercel React performance Skill catalogues additional rules that
reviewers reach for during PR review: `server-no-shared-module-state`,
`server-cache-react`, `bundle-analyzable-paths`,
`bundle-dynamic-imports`, `rendering-resource-hints`, and
`rerender-memo`. Quote the rule id when raising a concern.

## Component Rules

- Components should be plain TSX and receive explicit props. Avoid
  hidden reads from route params, sessions, request objects, or
  environment variables.
- Compose with children and slots rather than boolean prop matrices
  (`vercel-composition-patterns/architecture-avoid-boolean-props`).
- Prefer compound components over render-prop callbacks for nested
  pieces of the same widget.
- Recursive components should recurse by component name.
- React 19: do not introduce `forwardRef` for new components; refs
  flow through props.

## Client Interactivity

- React Router hydrates the app. Keep browser behavior in React
  components or hooks when it is interactive page chrome or progressive
  enhancement.
- Interactive components must call stable resource URLs through
  `API_ACTIONS` (`@/client/api/actions`) and `useApiFetcher`
  (`@/client/api/fetcher`); they must not import server modules.
- `src/assets/scripts` is intentionally absent. The legacy Astro
  browser-script pipeline has been removed; all interactivity lives
  inside React components/hooks under `@/client/` and `@/ui/`.
- Avoid adding new client dependencies unless the interaction genuinely
  needs them.

## Sessions, Env, And Security

- Sessions use React Router `createSessionStorage` with Redis
  persistence and a signed `__session` cookie. `SESSION_SECRET` is
  required.
- Server environment access goes through `@/server/env` (built on
  `@t3-oss/env-core` + Zod for runtime validation and typed exports).
- When adding environment variables, update the t3-env schema,
  `src/env.d.ts`, and `.env.example` together.
- Use `zod` directly; do not import `astro/zod` or deprecated Zod APIs.
- Security helpers such as CSRF and client-address parsing live in
  `@/server/auth/*` (server-side wiring) and `@/shared/request`,
  `@/shared/security` (isomorphic primitives). Keep them
  framework-neutral where possible.

## Assets

- React Router/Vite generated assets are emitted under
  `build/client/assets`.
- The production build does not upload generated assets to S3 and does
  not rewrite generated asset URLs through a build-time CDN base.
- Docker builds run `npm run build` and copy the local `build/` output
  into the runtime image.
- Public files and hard-coded absolute URLs are served as authored.

## Formatting And Lint

- `.ts` and `.tsx` are formatted with `oxfmt` and linted with `oxlint`.
- `.astro` files do not exist in this project; Astro-specific
  formatters and lint paths must not be re-added.
- Git hooks are owned by Vite+ (replacing the legacy `husky` +
  `lint-staged` setup). Committed hook scripts live in `.vite-hooks/*`
  (e.g. `.vite-hooks/pre-commit` → `vp staged`); the runtime wrapper
  under `.vite-hooks/_/` is generated by `vp config` and is gitignored.
  The `staged` task list is declared in `vite.config.ts` under the
  `staged` field. `npm install` runs the `prepare` script which calls
  `vp config` to point `core.hooksPath` at `.vite-hooks/_`. Set
  `VITE_GIT_HOOKS=0` to skip hook installation (used by the Dockerfile
  for non-git build contexts).

## Build And Check Commands

- `vp dev` — start the React Router dev server.
- `vp check` — run formatting, linting, and type checks.
- `vp test run` — run the test suite once.
- `vp build` — produce the production React Router build.
- `npm run preview` and `npm run start` remain runtime entry points
  for the built server (`react-router-serve ./build/server/index.js`).

## Editing Guidance

- Do not reintroduce `astro.config.ts`, `src/pages`, `.astro` route
  shells, `src/actions`, `src/middleware`, `src/layouts`,
  `src/services`, `src/hooks`, or `src/db`. These have been folded
  into the four-layer architecture above.
- There is intentionally no `@/ui/lib/` (or `src/lib/`) helper module
  today. Class-name composition is inlined as `twMerge(clsx(...))` at
  every call site so each primitive is self-contained. If the
  shadcn-registry adoption follow-up lands and re-introduces a `cn()`
  helper, follow whichever `aliases.lib` is recorded in
  `components.json` (per the `shadcn` Skill) and migrate every call
  site atomically — never split the convention across both styles.
- Keep server-only imports inside `src/server/` (or behind dynamic
  imports inside loaders/actions/resource routes if the call site
  must live elsewhere).
- Preserve public URLs, feed URLs, image endpoints, WordPress
  compatibility routes, and pagination routes unless explicitly asked
  to change them.
- When moving files, update both imports and documentation in the
  same change.

## Git And Commits

- Do not create commits unless explicitly asked.
- Before staging or committing, inspect `git status --short` and avoid
  mixing unrelated user changes into the commit unless the user asks
  for them.
- Commit messages should use semantic commit format by default:
  `<type>: <summary>`, or `<type>(<scope>): <summary>` when a scope
  helps. The separator after `feat`, `fix`, `docs`, `refactor`,
  `test`, `chore`, and other semantic types must be an ASCII English
  colon followed by one space. Example:
  `fix: reset public detail island state on route reuse`.
- Use an imperative, concise English summary. For multi-line messages,
  leave a blank line after the subject and keep body bullets focused
  on user-visible or reviewer-relevant changes.
- For code changes, run or report the relevant Vite+ validation before
  committing, normally `vp check`, `vp test run`, and `vp build`
  unless the user requested a narrower flow.

## Vite+, the Unified Toolchain

This project uses Vite+, a unified toolchain built on top of Vite,
Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps
runtime management, package management, and frontend tooling in a
single global CLI called `vp`. Vite+ is distinct from Vite, but it
invokes Vite through `vp dev` and `vp build`.

### Workflow Cheat Sheet

`vp` is a global binary that handles the full development lifecycle.
Run `vp help` for the full command list and `vp <command> --help` for
specifics. The most common commands:

| Command               | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `vp install` (`vp i`) | Install dependencies                                                 |
| `vp dev`              | Run the development server                                           |
| `vp check`            | Run format, lint, and TypeScript checks                              |
| `vp lint` / `vp fmt`  | Lint or format only                                                  |
| `vp test`             | Run tests (`vp test run` for one-shot)                               |
| `vp build`            | Build for production                                                 |
| `vp preview`          | Preview the production build                                         |
| `vp run <script>`     | Run a `package.json` script (e.g. `vp run dev` for the orchestrator) |
| `vp dlx <bin>`        | Execute a package binary without installing it                       |

Dependencies: use `vp add` / `vp remove` / `vp update` instead of
calling pnpm/npm/yarn directly. Vite+ detects the active package
manager from `packageManager` in `package.json`.

### Common Pitfalls

- Do not run pnpm, npm, or Yarn directly. Vite+ wraps them.
- Do not call `vp vitest` / `vp oxlint` — those subcommands do not
  exist; use `vp test` and `vp lint`.
- `vp dev`, `vp build`, `vp test` always run the Vite+ tool, never a
  `package.json` script of the same name. Use `vp run <script>` for
  custom scripts (e.g. `vp run dev` to start the orchestrator that
  runs the dev server alongside watchers).
- Do not install Vitest, Oxlint, Oxfmt, or tsdown directly. Vite+
  wraps these tools and pins them.
- Import test utilities from `vite-plus/test`
  (`import { expect, test, vi } from "vite-plus/test"`), not from
  `vitest` or `vite`.
- `vp lint --type-aware` works out of the box; do not install
  `oxlint-tsgolint`.

### CI Integration

For GitHub Actions, prefer
[`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to
replace separate `actions/setup-node`, package-manager setup, cache,
and install steps:

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

### Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before
      starting work.
- [ ] Run `vp check` and `vp test` to validate changes before opening
      a PR.
