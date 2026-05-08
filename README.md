<!-- markdownlint-disable MD033 MD041 -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/images/blog-poster-dark.png">
  <img alt="Yufan Blog Logo" src="public/images/blog-poster.png">
</picture>

# Yufan Personal Blog

[![Folo](https://badge.folo.is/feed/54772566650461214?color=FF5C00&labelColor=black&style=flat-square)](https://app.folo.is/share/feeds/54772566650461214)

Source code for [yufan.me](https://yufan.me): a React Router full-stack blog with a built-in `/wp-admin` console. Posts, pages, taxonomies, images, music, and settings all live in Postgres and are edited from the admin console; bodies are persisted as PortableText.

**Contributors:** read [AGENTS.md](AGENTS.md) first — architecture, import boundaries, install/settings contracts, and tooling (`vp`) expectations.

## Stack

| Layer      | Choice                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------- |
| App router | React Router 7 framework mode, SSR (`react-router.config.ts`)                                      |
| UI         | React 19, TSX only                                                                                 |
| Build      | Vite+ (`vp`) — Vite, Rolldown, Vitest, Oxlint, Oxfmt ([viteplus.dev](https://viteplus.dev))        |
| Content    | Posts and pages persist as PortableText in `page` / `post` + `content` tables, edited in admin     |
| Data       | Postgres (Drizzle), Redis (sessions, rate limits, caches)                                          |
| Assets     | S3-compatible bucket when enabled in settings                                                      |
| Styling    | Tailwind CSS v4 (`src/assets/styles/tailwind.css`), shadcn/ui (Base UI) under `src/ui/components/` |

## Repository layout

Imports flow one way: `routes` may call `server` / `shared` / `ui` / `client`; `server` never touches `ui` or `client`; `shared` stays isomorphic.

```
src/
├── routes/     Loaders, actions, meta, page components, resource routes, /api/actions/*
├── server/     DB, Redis, sessions, catalog, mail, S3 dispatch, settings
├── client/     Hooks, fetchers, browser-only code
├── ui/         Presentational components and the PortableText renderer
├── shared/     DTOs and helpers safe on server + client
└── assets/     Fonts, icons, global CSS
```

## Prerequisites

- Postgres and Redis reachable from the app
- Global `vp` CLI (install via Vite+ docs)

## Getting started

```bash
git clone https://github.com/syhily/yufan.me.git
cd yufan.me
cp .env.example .env
vp install
vp dev
```

Minimal `.env`:

```text
DATABASE_URL=postgres://user:pass@host:5432/db
REDIS_URL=redis://host:6379
SESSION_SECRET=<high-entropy secret>
```

First boot redirects to `/wp-admin/install.php` until an admin exists and core settings rows are seeded (see AGENTS.md → Configuration & Install).

## Commands

```bash
vp dev              # dev server + HMR
vp check            # format, lint, types
vp test             # watch tests
vp test run         # CI-style test run
vp build            # production build
vp preview          # serve production build locally
vp run db:generate  # Drizzle migration from schema edits
```

Use `vp add` / `vp remove` / `vp update` for packages (do not call npm/pnpm/yarn directly per project convention).

## Configuration

Runtime behaviour is driven by the `setting` table (`blog.general`, `blog.assets`, …), edited per section in `/wp-admin/settings/*`. There is no checked-in `blog.config.ts` or global defaults file — see AGENTS.md for the section registry and install gate.

## Content surfaces

| Surface                     | Where it lives         | Public URL                                        |
| --------------------------- | ---------------------- | ------------------------------------------------- |
| Posts                       | Postgres + admin       | `/posts/:slug`                                    |
| Pages                       | Postgres + admin       | `/:slug`                                          |
| Categories / tags / friends | Postgres + admin       | `/cats/:slug`, `/tags/:slug`, grids via page meta |
| Images / music              | Postgres + optional S3 | Admin libraries; PortableText body blocks         |

Slug rules and collisions between posts and pages are enforced in the catalog — AGENTS.md documents the global slug namespace.

## Deployment

The [Dockerfile](Dockerfile) runs `vp build` and ships `build/` with `npm run start` (`react-router-serve`). Default listen port `4321`. Generated Vite assets are **not** uploaded to S3 by the build; object storage is for user media only.

## License

- **Source code:** [MIT](LICENSE)
- **Bundled fonts / third-party:** [licenses/](licenses)
