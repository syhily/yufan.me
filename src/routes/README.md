# `src/routes/` — Route Module Conventions

Route modules orchestrate `loader` / `action` / `meta` / default
component for one URL each. They live alongside resource routes
(feeds, sitemap, OG images, JSON APIs) under the same folder so the
per-URL contract is obvious from the file system.

This README is the long-form companion to the **route manifest**
declared in `@/routes`. The manifest itself stays terse so the URL
table reads top-to-bottom; reach for this README when you need the
**why** behind a particular `layout()`, route ordering, or `id`
disambiguator.

---

## File Naming

We do **not** use React Router's segment-based filename convention
(`_index.tsx`, `($slug).tsx`, `…_._archive.tsx`). The URL is the
contract — duplicating a slash hierarchy in filenames hides logical
groupings (`category.list.tsx` is the same module behind both
`/cats/:slug` and `/cats/:slug/page/:num`) and makes grep-for-feature
harder. Instead, we use **`<area>.<role>[.subrole].tsx`**:

| Pattern                         | Example                                                                                                       | Meaning                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `<area>.detail.tsx`             | `post.detail.tsx`, `page.detail.tsx`                                                                          | Single-resource page.                                                                                                                     |
| `<area>.list.tsx`               | `category.list.tsx`, `tag.list.tsx`, `search.list.tsx`                                                        | Paginated listing — same module powers `/foo/:slug` AND `/foo/:slug/page/:num`.                                                           |
| `<area>.index.ts`               | `tags.index.ts`, `search.index.ts`                                                                            | Resource route returning a JSON / RSS / sitemap payload (no React component).                                                             |
| `<area>.<role>.ts`              | `feed.rss.ts`, `feed.atom.ts`, `image.og.ts`, `image.calendar.ts`, `image.avatar.ts`, `sitemap.ts`            | Resource route, role disambiguates one shared module across multiple URLs.                                                                |
| `<area>.layout.tsx`             | `public.layout.tsx`, `admin.layout.tsx`, `wp-admin.layout.tsx`, `wp-admin.settings.layout.tsx`                | Pathless or pathed layout — owns chrome, error boundary, and revalidation policy for its children.                                        |
| `wp-admin.<area>[.subrole].tsx` | `wp-admin.dashboard.tsx`, `wp-admin.comments.tsx`, `wp-admin.users.detail.tsx`, `wp-admin.settings.cache.tsx` | Admin shell pages. The double dot (`wp-admin.settings.cache`) keeps cache + general + localization + … visually grouped under one prefix. |
| `wp-admin.install.<stage>.tsx`  | `wp-admin.install.tsx`, `wp-admin.install.settings.tsx`                                                       | Install gate pages.                                                                                                                       |
| `wp-login.tsx`                  | n/a                                                                                                           | Standalone login page.                                                                                                                    |

When you add a new route, copy whichever of the above patterns best
matches the role and add the manifest entry in `@/routes`. Do not
introduce a fifth pattern.

---

## Manifest Anchors

The route manifest in `@/routes` is intentionally short (≈90
non-blank lines). Each block has an anchor comment that points back
to one of the sections below. If you find yourself wanting to write a
multi-paragraph rationale inside the manifest itself, write it here
instead and leave a single-line pointer in `routes.ts`.

### A. Public layout (`routes/public.layout.tsx`)

`public.layout.tsx` is a **pathless** layout (`layout(file, …)`) that
wraps every public-facing URL.

It owns the `<PublicChrome>` wrapper which **statically imports
`public.css`**. React Router only emits `<link rel="stylesheet">`
tags into the SSR `<Links />` output for stylesheets reachable from
the matched route module graph, so a static import inside the layout
guarantees the very first paint is fully styled. **Do not** lazy-load
`public.css` from a child route or move it into a regular component —
both would reintroduce FOUC for the public surface.

The admin / login / install / API routes live **outside** this
layout on purpose: the wp-admin SPA chunk and the JSON resource
routes must not pull the public stylesheet cascade into their
bundles.

### B. Splat catch-all inside the public layout

```ts
route('*', 'routes/not-found.tsx'),
```

The splat MUST stay last inside `public.layout.tsx`. React Router
treats `*` as the **lowest-priority** match, so this only fires for
paths nothing else handles — multi-segment WordPress probes such as:

- `/wp-content/plugins/x.php`
- `/cgi-bin/test`
- `/wp-includes/wlwmanifest.xml`

Single-segment `.php` or `cgi-bin` probes hit `:slug` first and are
intercepted inside `routes/page.detail.tsx` (see the wp-decoy
helper).

### C. Resource routes outside the public layout

Resource routes (feeds, sitemap, generated images, JSON APIs) sit
**outside** `public.layout.tsx`. They never render `<Outlet />`
chrome, never import `<PublicChrome>`, and must not pull
`public.css` into their bundle. Each one returns a `Response`
directly from a `loader` (GET) or `action` (POST/PATCH/DELETE).

### D. Feed URLs share two route modules

Six public feed URLs share **two** route modules
(`feed.rss.ts`, `feed.atom.ts`):

| URL                     | Module         | `id`                 |
| ----------------------- | -------------- | -------------------- |
| `/feed`                 | `feed.rss.ts`  | (default)            |
| `/feed/atom`            | `feed.atom.ts` | (default)            |
| `/cats/:slug/feed`      | `feed.rss.ts`  | `category-feed-rss`  |
| `/cats/:slug/feed/atom` | `feed.atom.ts` | `category-feed-atom` |
| `/tags/:slug/feed`      | `feed.rss.ts`  | `tag-feed-rss`       |
| `/tags/:slug/feed/atom` | `feed.atom.ts` | `tag-feed-atom`      |

The modules infer category / tag scope from the request URL via
`scopeFromUrl`, so the only thing that varies across the three
patterns per format is the React Router `id` (which has to stay
unique). When you add a new scope, copy the existing pattern instead
of forking the loader.

### E. API routes (Hono layer)

All internal API endpoints live in the Hono server (`src/server/http/`)
and are mounted as oRPC procedures. They do **not** appear in
`routes.ts` — the React Router manifest only contains page routes.

### F. Auth split-screen layout (`routes/admin.layout.tsx`)

`routes/admin.layout.tsx` owns the public-facing left/right
split-screen layout shared by login, the stage-1 install (admin
sign-up), and the stage-2 install (settings). These three routes
share the same chrome but are **independent** of the wp-admin SPA
shell.

### G. wp-admin SPA shell (`routes/wp-admin.layout.tsx`)

The SPA admin shell owns its own chrome (sidebar + topbar) under
`routes/wp-admin.layout.tsx`. It opts out of `BaseLayout` via
`handle.layout = 'admin'` and does **not** reuse the public
login/install split-screen layout from section F.

### H. Settings sub-layout (`routes/wp-admin.settings.layout.tsx`)

Twelve `/wp-admin/settings/*` URLs share a single sub-layout that
hydrates the full `BlogSettingsBundle` once and exposes the
`{ settings, bundle, timeZones }` triple via `useOutletContext()`.
The layout also asserts the bundle invariant up front (see
`SettingsBundle` type) so child routes never have to handle a
partial install.
