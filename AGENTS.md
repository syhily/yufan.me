# AGENTS.md

Repository conventions for AI agents and contributors. Read this before
authoring routes, content loaders, templates, browser scripts, or server code.

## Stack

- React Router 7 Framework Mode with SSR enabled. `react-router.config.ts`
  keeps `appDirectory` at `src` and enables `future.v8_middleware`.
- Vite is the build system. `vite.config.ts` wires React Router, Fumadocs MDX,
  binary asset imports, path aliases, and build-time `ASSET_BASE_URL`.
- Fumadocs MDX compiles `src/content/posts` and `src/content/pages`; meta data
  lives in `src/content/metas/*.yaml` and is configured from `source.config.ts`.
- React 19 is the view layer. Route modules and components are TSX/TS only;
  there should be no `.astro`, `astro:*`, or `@astrojs/*` runtime code.
- Postgres stores comments, users, likes, and counters. Redis backs sessions,
  rate limits, avatars, and generated-image caches.

## File Layout

- `src/root.tsx` is the only document shell. It imports global CSS and renders
  React Router `Meta`, `Links`, `Outlet`, `ScrollRestoration`, and `Scripts`.
- `src/routes.ts` is the route manifest. Public URLs must stay stable when route
  modules move.
- `src/routes/**/*.tsx` are page route modules with `loader`, `action`, `meta`,
  and default components as needed.
- `src/routes/**/*.ts` are resource routes such as feeds, sitemap, generated
  images, and API/action endpoints.
- `src/routes/_shared/*.server.ts` contains route-only server helpers.
- `src/services/catalog/index.ts` is the content catalog over Fumadocs output.
  Public content access goes through `src/services/catalog/schema.ts`; helpers
  that query database metadata live in `schema.server.ts`.
- `src/components/**/*.tsx` contains reusable React components. Prefer editing
  existing components over introducing small one-off wrappers.
- `src/components/partial/Image.tsx` is the framework-neutral image component.
  It preserves the old UPYUN transform URL shape for configured remote assets.
- `src/assets/icons/Icon.tsx` renders inline SVG icons. Raw SVG files live under
  `src/assets/icons/svg/*.svg`; keep code and SVG resources separated.
- `src/assets/scripts/**/*.ts` are browser-only scripts restored for SSR pages.
  They call React Router resource routes through `src/assets/scripts/shared`.
- `src/**/*.server.ts` is server-only. Keep database, Redis, session, email,
  cache, and filesystem logic out of browser-reachable modules.

## Routing And Data

- Use React Router `loader` for render-time data and `action` for route form
  submissions.
- Use `redirect`, `data`, `Response`, and thrown responses instead of legacy
  Astro redirects, rewrites, response mutation, or actions.
- Keep admin authentication and session reads in loaders/actions. UI components
  should receive plain DTO props and should not import session or database code.
- `src/routes/api-action.tsx` replaces the previous Astro actions layer for
  comment, like, avatar, admin comment, and related browser-script requests.
- Resource routes replace former `src/pages/**/*.ts` endpoints for feeds,
  sitemap, Open Graph images, calendar images, and avatar images.

## Content

- Do not use `astro:content`. Fumadocs collections are declared in
  `source.config.ts`.
- Posts stay in `src/content/posts/**/*.mdx`; pages stay in
  `src/content/pages/**/*.mdx`.
- Meta collections are YAML files in `src/content/metas`: `categories.yaml`,
  `tags.yaml`, and `friends.yaml`.
- URLs are based on MDX frontmatter `slug`, not physical filenames. Posts render
  at `/posts/:slug`; pages render at `/:slug`.
- The catalog returns compiled MDX components through `body`, headings, raw
  source, and structured data. Do not reintroduce Astro `render()` semantics.
- Custom MDX components live under `src/components/mdx`; preserve existing math,
  Mermaid, heading slug, external link, title figure, and Shiki behavior via
  `source.config.ts`.

## Component Rules

- Components should be plain TSX and receive explicit props. Avoid hidden reads
  from route params, sessions, request objects, or environment variables.
- For raw HTML, use `dangerouslySetInnerHTML` directly on the host element. Do
  not recreate a generic `Html` helper.
- For conditional classes, build the `className` string locally. Do not recreate
  a generic `cx` helper for one-off use.
- Use `<Image />` from `src/components/partial/Image.tsx` for transformed
  remote images.
- Use `<Icon name="..." />` from `src/assets/icons/Icon.tsx` for inline SVG.
- Recursive components should recurse by component name.

## Client Interactivity

- React Router hydrates the app, but keep browser behavior in
  `src/assets/scripts` when it is page chrome or progressive enhancement rather
  than React component state.
- Browser scripts must call stable resource URLs, not import server modules.
- Shared request helpers for browser scripts live in
  `src/assets/scripts/shared/actions.ts`.
- Avoid adding new client dependencies unless the interaction genuinely needs
  them.

## Sessions, Env, And Security

- Sessions use React Router `createSessionStorage` with Redis persistence and a
  signed `__session` cookie. `SESSION_SECRET` is required.
- Server environment access should go through `src/shared/env.server.ts`, which
  uses `@t3-oss/env-core` and Zod for runtime validation and typed exports.
- When adding environment variables, update the t3-env schema, `src/env.d.ts`,
  and `.env.example` together.
- Use `zod` directly; do not import `astro/zod` or deprecated Zod APIs.
- Security helpers such as CSRF and client address parsing live in shared
  server/request modules. Keep them framework-neutral where possible.

## Assets, CDN, And Uploads

- Vite `base` is set from `ASSET_BASE_URL` only during production builds.
  React Router generated JS/CSS/font asset URLs can therefore point at a CDN.
- `scripts/upload-assets.mjs` replaces the old `astro-uploader` hook. It uploads
  `build/client/assets` when `UPLOAD_STATIC_FILES=true`.
- S3 upload configuration uses `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
  `S3_ACCESS_KEY`, `S3_SECRET_ACCESS_KEY`, and optional `S3_PREFIX`.
- If `S3_PREFIX` is unset, the upload prefix is derived from the pathname of
  `ASSET_BASE_URL`.
- Public files and hard-coded absolute URLs are not automatically rewritten by
  Vite `base`; only generated build assets are.

## Formatting And Lint

- `.ts` and `.tsx` are formatted with `oxfmt` and linted with `oxlint`.
- `.astro` files should not exist. Do not add Astro formatters or Astro-only
  lint paths back to the project.
- `src/assets/scripts/**/*` is excluded from TypeScript project typecheck; keep
  those scripts lint-clean and build-verified.

## Build And Check Commands

- `npm run dev` starts the React Router dev server.
- `npm run build` runs `react-router build` and then `scripts/upload-assets.mjs`.
- `npm run preview` and `npm run start` run
  `react-router-serve ./build/server/index.js`.
- `npm run typecheck` runs React Router type generation and `tsc`.
- `npm run lint` runs `oxlint`.

## Editing Guidance

- Do not reintroduce `astro.config.ts`, `src/pages`, `.astro` route shells,
  `src/actions`, or `src/web/middleware`.
- Do not remove existing browser scripts under `src/assets/scripts`; they are
  required for SSR-rendered page interactions.
- Keep server-only imports behind `.server.ts` boundaries or dynamic imports
  inside loaders/actions/resource routes.
- Preserve public URLs, feed URLs, image endpoints, WordPress compatibility
  routes, and pagination routes unless explicitly asked to change them.
- When moving files, update both imports and documentation in the same change.
