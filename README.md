<!-- markdownlint-disable MD033 MD041 -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/images/blog-poster-dark.png">
  <img alt="Yufan Blog Logo" src="public/images/blog-poster.png">
</picture>

# Yufan Personal Blog

[![Folo](https://badge.folo.is/feed/54772566650461214?color=FF5C00&labelColor=black&style=flat-square)](https://app.folo.is/share/feeds/54772566650461214)

Source code for [yufan.me](https://yufan.me) — a personal blog built on
React Router 7, React 19, Postgres, and Fumadocs MDX. The site doubles
as a single-tenant CMS: posts and pages are MDX files in the repo, while
everything else (taxonomies, friends, images, music, settings) is
edited from a built-in `/wp-admin` admin shell.

> **Working on the codebase?** Read [AGENTS.md](AGENTS.md) first. It
> is the single source of truth for architecture conventions, RSC
> layering rules, and the defensive constraints that protect against
> previously-removed patterns.

## Stack

- **React Router 7** in framework mode with SSR (`react-router.config.ts`).
- **React 19** as the only view layer. No Astro, no Next.js, no MPA glue.
- **Vite+** ([viteplus.dev](https://viteplus.dev)) is the unified
  toolchain — a single `vp` CLI that wraps Vite, Rolldown, Vitest,
  tsdown, Oxlint, Oxfmt, package management, and git-hook installation.
  See `vp help` for the full surface; this README only covers the
  commands you need to ship.
- **Fumadocs MDX** compiles `src/content/posts` with project-customised
  math, Mermaid, Shiki, heading slug, external link, and title-figure
  rehype plugins (see `source.config.ts`). Pages live in Postgres and
  are edited through `/wp-admin/pages`, then rendered as PortableText.
- **Drizzle ORM** over a Postgres pool. Schema in
  `src/server/db/schema.ts`; SQL migrations live in `drizzle/` and run
  automatically on server startup.
- **Redis** (via `ioredis`) backs sessions, rate limits, generated-image
  caches, and avatars.
- **shadcn/ui** (Base UI variant) under `src/ui/components/ui/` —
  shared by both the public site and the admin shell.
- **Tailwind CSS v4** with `@theme inline` tokens defined once at
  `:root` in `src/assets/styles/tailwind.css`.
- **S3-compatible object storage** (any provider) for images and music
  uploads, gated behind a single admin toggle.

## Architecture

The codebase is organised into four layers under `src/` with a
one-way import graph, so the server bundle and the client bundle can
be reasoned about independently:

```
src/
├── routes/    # Route modules (loader / action / meta / component) and
│              # resource routes for feeds, sitemap, generated images,
│              # and /api/actions/<domain>/<name> endpoints.
├── server/    # SSR-only. Drizzle, Redis, sessions, mail, settings,
│              # markdown pipeline, S3 dispatch, install gate.
├── client/    # Browser-only. useApiFetcher and the API_ACTIONS
│              # manifest. Heavy widgets reach the bundle through
│              # React.lazy from a UI component.
├── ui/        # Pure-props React components. shadcn primitives,
│              # domain UIs, MDX renderers, icons, the cn() helper.
├── shared/    # Strictly isomorphic, side-effect-free DTOs and
│              # primitives safe in both bundles.
├── content/   # MDX collections (posts, pages) and authored licenses.
└── assets/    # Static assets — icon SVGs, fonts, stylesheets.
```

Key rules at a glance (full text in [AGENTS.md](AGENTS.md)):

- `server/*` may not import from `client/*` or `ui/*`.
- `client/*` and `ui/*` may not import from `server/*` or any
  `*.server.*` file.
- `shared/*` runs in both bundles — no Node built-ins, no `ioredis`,
  no `drizzle-orm`, no DOM-only APIs, no direct `process.env` reads.
- Routes orchestrate; UI receives plain DTO props; nothing inside the
  JSX tree reaches back into `server/`.

## Getting Started

Prerequisites: a running Postgres, a running Redis, and the global
`vp` binary. Install Vite+ once per machine following
[viteplus.dev](https://viteplus.dev).

```bash
git clone https://github.com/syhily/yufan.me.git
cd yufan.me
cp .env.example .env
vp install
vp dev
```

Required environment variables:

```text
DATABASE_URL=postgres://user:pass@host:5432/db
REDIS_URL=redis://host:6379
SESSION_SECRET=  # any high-entropy secret; required for cookie signing
```

Open <http://localhost:4321>. On a fresh install the
`installGateMiddleware` redirects every request to
`/wp-admin/install.php` until the first admin account and the
`blog.general` + `blog.assets` settings rows have been seeded (see
[Configuration & Install](#configuration--install) below).

### Common Commands

```bash
vp dev              # development server with HMR
vp check            # format check, lint, and typecheck
vp test             # tests in watch mode
vp test run         # tests one-shot
vp build            # production build
vp preview          # serve the production build locally
vp dlx vite-node scripts/<file>.ts  # run a TS script with project aliases
vp run db:generate  # generate a SQL migration from src/server/db/schema.ts
```

Use `vp add` / `vp remove` / `vp update` for dependencies — `vp`
detects the package manager from `packageManager` in `package.json`.
Do not invoke `pnpm` / `npm` / `yarn` directly.

### Database Migrations

1. Edit `src/server/db/schema.ts`.
2. Run `vp run db:generate`. Drizzle Kit writes a new SQL file under
   `drizzle/`.
3. Commit both the schema change and the generated SQL together.

The runtime applies any pending migration in `drizzle/` on server
startup, behind a Postgres advisory lock so concurrent boots do not
race.

## Configuration & Install

There are no `astro.config.ts`, `src/blog.config.ts`, or
`DEFAULT_SETTINGS` constants. Every runtime knob lives in a Postgres
row, edited from the admin shell:

- **Per-section settings** — one JSONB row per section in the `setting`
  table (`blog.general`, `blog.assets`, `blog.navigation`,
  `blog.socials`, `blog.content`, `blog.sidebar`, `blog.comments`,
  `blog.seo`, `blog.footer`, `blog.mail`, `blog.cache`). Each section
  is edited from `/wp-admin/settings/<section>` and writes only its
  own row, so concurrent admin tabs cannot race.
- **Two-stage install** — `/wp-admin/install.php` creates the first
  admin account and auto-logs in; `/wp-admin/install/settings.php`
  persists the form data and seeds the remaining sections from the
  registry defaults. 11 rows are written atomically so the very first
  public render after install can use the strict per-section hooks.
- **Image and music storage** — both share the
  `assets.storage.enabled` toggle in `setting('blog.assets')`.
  - **Toggle ON** — uploads go to the configured S3-compatible bucket
    (`@/server/images/s3-client`, AWS SDK loaded lazily). Public URLs
    are `<publicBaseUrl>/<storagePath>` so any CDN can sit in front.
  - **Toggle OFF** (default for fresh installs) — every PUT/DELETE
    returns 503 and the admin libraries are read-only, but the SSR
    enhancer keeps resolving historical rows so older posts still
    render. Flip the toggle on at `/wp-admin/settings/assets`; saved
    credentials persist across toggles.

## Content

| Surface    | Source                                    | URL                             |
| ---------- | ----------------------------------------- | ------------------------------- |
| Posts      | `src/content/posts/**/*.mdx`              | `/posts/:slug`                  |
| Pages      | `page` table → `/wp-admin/pages`          | `/:slug`                        |
| Categories | `category` table → `/wp-admin/categories` | `/cats/:slug`                   |
| Tags       | `tag` table → `/wp-admin/tags`            | `/tags/:slug`                   |
| Friends    | `friend` table → `/wp-admin/friends`      | rendered via `<Friends />` MDX  |
| Images     | `image` table → `/wp-admin/images`        | `<publicBaseUrl>/<storagePath>` |
| Music      | `music` table → `/wp-admin/musics`        | `<MusicPlayer id="..." />` MDX  |

URL slugs come from MDX frontmatter, not physical filenames. Frontmatter
schemas live in [`source.config.ts`](source.config.ts). MDX references
categories and tags by `name`, so an admin rename must stay in sync
with author edits in MDX — the catalog throws on cold start when a
post references a missing category and warns when it references a
missing tag.

`visible=false` posts are hidden from the public home and random-post
widgets, but are intentionally **kept** in `/archives`, `/tags/:slug`,
`/search/:keyword`, `sitemap.xml`, all RSS/Atom feeds, category
listing pages, and category/tag counts. Future-dated posts remain
excluded from those listings until their publish time.

## Deployment

The provided [`Dockerfile`](Dockerfile) runs `vp build` and copies the
`build/` output into a slim Node runtime image. The container's entry
point is the built server:

```bash
npm run start  # react-router-serve ./build/server/index.js
```

The server listens on `PORT` (default `4321`). The image is suitable
for any Docker-capable host; deployment to [Zeabur](https://zeabur.com)
is the upstream's reference target.

The production build does not upload generated assets to S3 and does
not rewrite asset URLs through a build-time CDN base — public files
and hard-coded absolute URLs are served as authored.

## TODO

- [ ] Move static MDX files to PortableText and Postgres
- [ ] Add font size switch in post and page
- [ ] Add new traditional chinese layouts
  - [ ] Use opencc for chinese characters converting
  - [ ] Chinese punctuation converting
  - [ ] Add horizontal and vertical layouts for traditional chinese
  - [ ] Use genyo font for traditional chinese characters
- [ ] Add dark theme
- [ ] Responsive image design for blog images
- [ ] Code refactoring for better organization
- [ ] Audit log for backend administration

## License

- Source code — [MIT](LICENSE).
- Blog content under [`src/content`](src/content) —
  [CC BY-NC-SA 4.0](src/content/LICENSE).
- Bundled fonts and other third-party notices —
  [`licenses/`](licenses).
