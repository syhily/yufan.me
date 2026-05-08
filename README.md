<!-- markdownlint-disable MD033 MD041 -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/images/blog-poster-dark.png">
  <img alt="Yufan Blog Logo" src="public/images/blog-poster.png">
</picture>

# Yufan Personal Blog

[![Folo](https://badge.folo.is/feed/54772566650461214?color=FF5C00&labelColor=black&style=flat-square)](https://app.folo.is/share/feeds/54772566650461214)

Source code for [yufan.me](https://yufan.me), a personal blog built with
React Router, React, Vite, and Fumadocs MDX.

## Stack

- React Router 7 Framework Mode with SSR.
- React 19 for UI.
- Vite+ for local tooling, checks, tests, and builds.
- Fumadocs MDX for posts, pages, and metadata collections.
- Postgres and Redis for comments, likes, sessions, rate limits, and caches.

For contributor conventions and project-specific architecture notes, read
[AGENTS.md](AGENTS.md).

## Getting Started

```bash
cp .env.example .env
vp install
vp dev
```

Fill the required values in `.env` before using database-backed features:

```text
DATABASE_URL=
REDIS_URL=
SESSION_SECRET=
```

Database schema changes are authored in [src/db/schema.ts](src/db/schema.ts).
Generate committed SQL migrations with:

```bash
vp run db:generate
```

The server applies pending migrations from [drizzle](drizzle) automatically on
startup.

## Commands

```bash
vp dev       # start the development server
vp check     # format, lint, and typecheck
vp test      # run tests
vp build     # build for production
vp preview   # serve the production build locally
```

Use `vp` for dependency and toolchain operations. Production and Docker entry
points may still call the npm scripts defined in [package.json](package.json)
because those scripts are the runtime wrapper around the built server.

## Content

- Posts live in `src/content/posts/**/*.mdx` and render at `/posts/:slug`.
- Pages live in `src/content/pages/**/*.mdx` and render at `/:slug`.
- Categories, tags, and friends are stored in Postgres and managed at
  `/wp-admin/categories`, `/wp-admin/tags`, and `/wp-admin/friends`.
- Frontmatter schemas are defined in [source.config.ts](source.config.ts).
- Runtime site settings (title, navigation, socials, sidebar, mail, cache,
  music CDN, locale, time zone, …) live in `setting('blog.<section>')`
  rows and are edited from `/wp-admin/settings/*`. The first-run install
  flow at `/wp-admin/install.php` seeds the rows alongside the initial
  admin account; until that completes, every request is redirected to
  the install page by `installGateMiddleware`.
- Image assets are managed at `/wp-admin/images`. The library is
  gated by a single `assets.storage.enabled` toggle persisted under
  `setting('blog.assets')`:
  - **Toggle ON** — uploads are processed in-browser (crop / rotate /
    re-encode), shipped through a multipart `POST`, re-encoded via
    `sharp` with `thumbhash`, written to the configured S3-compatible
    bucket, and recorded in the `image` table with `source='s3'`.
    Public URLs are `<publicBaseUrl>/<storagePath>` so any CDN can
    sit in front of the bucket.
  - **Toggle OFF (default for fresh installs)** — the library page is
    read-only: the admin can browse historical rows and the public
    SSR enhancer keeps resolving them against the saved
    `publicBaseUrl`, but every upload / replace entry point returns
    `503` until the operator opens `/wp-admin/settings/assets` and
    flips the toggle on.

The `visible=false` post flag hides content from the public home listing and
random post widgets. Hidden posts are intentionally still included in archives,
tag/category/search listings, feeds, sitemap, and taxonomy counts. Future-dated
scheduled posts remain excluded from public listing/feed/sitemap/taxonomy
surfaces.

## Deployment

The app can run on Zeabur or any Docker-capable host. The provided
[Dockerfile](Dockerfile) builds the React Router app, copies `build/`, installs
production dependencies, and starts:

```bash
npm run start
```

The server runs `react-router-serve ./build/server/index.js` and listens on
`PORT`.

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

Source code is licensed under [MIT](LICENSE). Blog content under
[src/content](src/content) is licensed under
[CC BY-NC-SA 4.0](src/content/LICENSE). Additional font and third-party license
files are kept in [licenses](licenses).
