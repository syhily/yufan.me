<!-- markdownlint-disable MD001 MD033 MD041 -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/images/blog-poster-dark.png">
  <img alt="Yufan Blog Logo" src="public/images/blog-poster.png">
</picture>

# Yufan Personal Blog

[![Folo](https://badge.folo.is/feed/54772566650461214?color=FF5C00&labelColor=black&style=flat-square)](https://app.folo.is/share/feeds/54772566650461214)

This is the source code for [yufan.me](https://yufan.me).

## History

The source code has gone through five major stages:

- Initially, it was built with WordPress in 2011.
- In 2017, the blog migrated to Hexo, and all posts were converted to Markdown.
- By 2024, the blog was completely rewritten using Next.js with the App Router.
- At the end of 2024, it transitioned to Astro.
- It now runs on React Router Framework Mode with Fumadocs MDX for content.

## Tech Stack

1. React Router 7 Framework Mode for SSR routing and actions.
2. React 19 as the view layer.
3. Vite for builds, asset handling, and dev server integration.
4. Fumadocs MDX for MDX compilation and content collections.
5. Postgres for post statistics, comments, likes, and users.
6. Redis for sessions, rate limits, avatar cache, and generated-image cache.
7. Zeabur or Docker for hosting.

## Architecture

The project no longer uses Astro runtime, `.astro` templates, `astro:content`,
or Astro actions. The app is structured around React Router route modules:

- `react-router.config.ts` enables SSR and keeps the app directory at `src`.
- `vite.config.ts` wires React Router, Fumadocs MDX, binary imports, aliases,
  and build-time `ASSET_BASE_URL`.
- `src/root.tsx` owns the document shell and imports global CSS.
- `src/routes.ts` declares all public routes and resource routes.
- `src/routes/**/*.tsx` renders pages and handles page-level loaders/actions.
- `src/routes/**/*.ts` handles resource responses such as feeds, sitemap,
  generated images, avatars, and API-style actions for browser scripts.
- `src/routes/_shared/site-data.server.ts` contains shared route loader helpers.
- `src/**/*.server.ts` marks server-only modules for database, Redis, sessions,
  email, cache, feed generation, and metadata loading.

Public URLs are intentionally preserved, including `/`, `/page/:num`,
`/posts/:slug`, `/:slug`, `/cats/:slug`, `/tags/:slug`, search pagination,
feeds, sitemap, generated image routes, and WordPress compatibility routes.

## Content Pipeline

Content is compiled by Fumadocs MDX through `source.config.ts`.

- Posts live in `src/content/posts/**/*.mdx`.
- Pages live in `src/content/pages/**/*.mdx`.
- Meta collections live in `src/content/metas/*.yaml`.
- Post and page URLs are based on frontmatter `slug`, not file names.
- `src/services/catalog/index.ts` builds the in-memory content catalog.
- `src/services/catalog/schema.ts` is the public content accessor layer.
- `src/services/catalog/schema.server.ts` adds database-backed metadata helpers.

The MDX pipeline keeps the existing behavior for math, Mermaid, title figures,
external links, heading slugs/autolinks, Shiki highlighting, table of contents,
structured data, and custom MDX components such as `MusicPlayer`, `Solution`,
and `Friends`.

## Components And Assets

- React components live under `src/components/**/*.tsx`.
- Layout chrome lives in TSX layout components under `src/layouts`.
- Browser-only progressive enhancement scripts live under `src/assets/scripts`.
- Inline SVG rendering uses `src/assets/icons/Icon.tsx`.
- Raw SVG files live under `src/assets/icons/svg/*.svg`.
- Transformed remote images use `src/components/partial/Image.tsx`, which emits
  the same UPYUN transform URL shape used by the previous image service.
- Raw HTML snippets are rendered with local `dangerouslySetInnerHTML`; there is
  no shared `Html` helper.
- Conditional `className` strings are built locally; there is no shared `cx`
  helper.

## Actions And Browser Scripts

Astro actions were replaced with React Router actions and resource routes.
Browser scripts in `src/assets/scripts` call stable endpoints instead of Astro
action helpers. The main endpoint is:

```text
/api/actions/:domain/:name
```

This endpoint covers comments, likes, avatar lookup, admin comment operations,
and other interaction flows needed by SSR-rendered pages.

## Local Development

Copy the example environment file, install dependencies, and start the React
Router dev server:

```bash
cp .env.example .env
npm i
npm run dev
```

Required local environment variables:

```text
DATABASE_URL=postgresql://username:password@localhost:port/yufan-me
REDIS_URL=redis://:password@localhost:port
SESSION_SECRET=replace-with-a-long-random-secret
```

All non-sensitive blog configuration lives in `src/blog.config.ts`.
Server environment variables are validated through `@t3-oss/env-core` in
`src/shared/env.server.ts`; keep that schema and `.env.example` in sync when
adding new variables.

Framework configuration is split across:

- `react-router.config.ts` for React Router framework settings.
- `vite.config.ts` for Vite plugins, aliases, dev server, and CDN base URL.
- `source.config.ts` for Fumadocs MDX collections and MDX plugins.

### Prepare The Postgres Database

Postgres is required for post click counts, comments, likes, and users.
The database schema is generated by `drizzle-kit`.
For convenience, SQL files are also provided in the [./migration](./migration)
directory. Run them one by one in filename order to initialize a usable
database.

### Useful Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run preview
```

`npm run build` runs `react-router build` and then
`scripts/upload-assets.mjs`. Asset uploading is skipped unless
`UPLOAD_STATIC_FILES=true`.

## Writing

All posts should be placed in the `src/content/posts` directory in MDX format.
All static pages should be placed in the `src/content/pages` directory, also in
MDX format. You can include custom scripts or components by leveraging MDX
capabilities.

### Front Matter

Front matter is a YAML block at the top of a file used to configure content
settings. It is enclosed by triple dashes.

```yaml
---
title: Hello World
slug: hello-world
date: 2013/7/13 20:46:25
---
```

### Post Front Matter Settings

| Setting | Description | Required | Default |
| --- | --- | --- | --- |
| `slug` | Unique ID, used as the permalink under `/posts/:slug` | true | |
| `title` | Title of the post | true | |
| `date` | Publication date. Future dates will be treated as scheduled | true | |
| `updated` | Last updated date | false | Published date |
| `comments` | Enable comments for the post | false | `true` |
| `tags` | Tags associated with the post | false | `[]` |
| `category` | Category of the post | true | |
| `summary` | Post summary in plain text | false | `''` |
| `cover` | Cover image | false | Category cover |
| `og` | Open Graph image | false | Generated image |
| `published` | Whether the post is published | false | `true` |
| `visible` | Whether the post appears in feeds and listings | false | `true` |
| `toc` | Display the Table of Contents | false | `false` |
| `alias` | Alternative slugs for redirects/lookups | false | `[]` |

### Pages Front Matter Settings

| Setting | Description | Required | Default |
| --- | --- | --- | --- |
| `slug` | Unique ID, used as the permalink under `/:slug` | true | |
| `title` | Title of the page | true | |
| `date` | Publication date | true | |
| `updated` | Last updated date | false | Published date |
| `comments` | Enable comments for the page | false | `true` |
| `summary` | Page summary in plain text | false | `''` |
| `cover` | Cover image | true | |
| `og` | Open Graph image | false | Generated image |
| `published` | Whether the page is published | false | `true` |
| `toc` | Display the Table of Contents | false | `false` |

### Using VS Code

The [FrontMatter](https://frontmatter.codes/) extension is configured for a
smoother local writing workflow. Install it and start writing in VS Code without
worrying about the front matter schema above. The extension will help manage
these fields automatically.

### Using Pandora Tool

[Pandora](https://github.com/syhily/pandora) is a companion tool for writing
posts with this project. You can install it by following its `README.md`.

It helps process music and images, then uploads these assets to the UPYUN
service. Images uploaded by Pandora can be rendered through the local `Image`
component with optimized transform URLs.

## CDN And Static Assets

React Router and Vite generated assets can be served from a CDN by setting
`ASSET_BASE_URL` during production builds:

```text
ASSET_BASE_URL=https://cdn.example.com/static/
```

The build-time Vite base URL rewrites generated JS, CSS, font, and other Vite
assets. Public files and hard-coded absolute URLs are not automatically
rewritten.

To upload generated assets after a build, enable:

```text
UPLOAD_STATIC_FILES=true
S3_ENDPOINT=
S3_REGION=auto
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_ACCESS_KEY=
S3_PREFIX=
```

If `S3_PREFIX` is not set, `scripts/upload-assets.mjs` derives the upload
prefix from the pathname of `ASSET_BASE_URL`. For example,
`https://cdn.example.com/static/` uploads generated assets under
`static/assets/...`.

## Deploy The Blog

This blog can be deployed on [Zeabur](https://zeabur.com) or self-hosted with
the provided [Dockerfile](./Dockerfile).

The Docker image builds the app with `react-router build`, copies the
`build/` output, installs production dependencies, and starts the server with:

```bash
npm run start
```

The production server runs `react-router-serve ./build/server/index.js` and
listens on `PORT`, defaulting to `4321` in the Dockerfile.

## Blog Design

The favicon closely resembles the blog logo, with simplified elements for
better readability at smaller sizes. It retains the main shape from the logo
but adjusts the dot color for visibility. The background color is embedded in
the exported favicon to ensure clear display across all browsers.

The favicon sizing follows this
[guide](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs)
to ensure compatibility across platforms.

## License

The source code of this blog is licensed under the [MIT](LICENSE) license.
Feel free to use it under the terms of that license.

The [content](src/content) of this blog's posts is licensed under the
[CC BY-NC-SA 4.0](src/content/LICENSE) license.

### Logo Fonts License

- [M+A1](https://booth.pm/ja/items/2347968)([license](licenses/LICENSE.m-plus.txt))
- [UnGungseo](https://kldp.net/unfonts)([license](licenses/LICENSE.un-fonts.txt))
- [Iroha Mochi](https://modi.jpn.org/font_iroha-mochi.php)([license](licenses/LICENSE.iroha-mochi.txt))

All of these fonts are free for commercial use.

### Web Font License

- [OPPOSans 4.0](https://open.oppomobile.com/new/developmentDoc/info?id=13223) ([license](licenses/LICENSE.opposans.txt))
- [OPPOSerif](https://open.oppomobile.com/new/developmentDoc/info?id=13223) ([license](licenses/LICENSE.opposans.txt))
- [Iosevka](https://github.com/be5invis/Iosevka) ([license](linceses/LICENSE.iosevka.txt))

### Open Graph Font License

- [NoteSans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC)([license](licenses/LICENSE.notosans.txt))

### Third-Party Code License

Some code in this project was adapted from other open-source projects.
Relevant credits and license information are included in the source file
headers.
