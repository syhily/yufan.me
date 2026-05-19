# Routes conventions

`src/routes/` contains route modules — loader / action / meta /
component orchestration. Read session/context at the perimeter, call
into `server/`, project DTOs through `shared/`, render with `ui/`. No
DB queries, Redis access, or markdown parsing inline.

## Route trees

Page modules grouped into four nested trees, each with its own layout
(`routes/<tree>/layout.tsx`):

- `routes/public/` — public site. Layout + `home`, `archives`,
  `categories`, `category/list`, `tag/list`, `search/list`,
  `post/detail`, `page/detail`, `not-found`.
- `routes/auth/` — split-screen login + install: `signin`,
  `setup/index` (`/admin/setup`), `setup/settings`
  (`/admin/setup/settings`).
- `routes/admin/` — admin SPA. `dashboard`, `comments`,
  `users/{index,detail}`, `my/{profile,comments,sessions}`,
  `security/sessions`, `friends`, `categories`, `tags`, `pages/index`,
  `posts/{index,analytics}`, `library/images`, `library/music`,
  `restore`, `analytics/{layout,overview,realtime,mentions}`,
  `settings/{layout,…}` — one file per settings section.
- `routes/editor/` — standalone immersive editing shell (split from
  `routes/admin/`). `post/{new,edit,analytics}`, `page/{new,edit}`. Owns
  its own layout so the editor chrome is free of admin SPA chrome.

## Patterns

- Use `loader` for render-time data, `action` for route form submissions.
- Use `redirect`, `data`, `Response`, and thrown responses for control
  flow.
- **Non-page requests** (API, feeds, sitemap, generated images) are
  served by Hono native routes mounted in `server.ts`, NOT React Router
  resource routes.
- Public URLs and physical paths stay stable — React Router derives
  route ids from the file path.
- Route components must accept plain props and not reach back into
  `server/*` inside the JSX tree.

## Content patterns

- `post` + `content` → `/posts/:slug`. `page` + `content` → `/:slug`.
  Both rendered via `<PortableTextBody>`. Public URLs use `slug`, not
  internal id.
- Custom block components in `@/ui/pt/blocks/`.
- `visible=false` posts are hidden from the public home and random-post
  widgets but stay in `/archives`, `/tags/:slug`, `/search/:keyword`,
  `sitemap.xml`, feeds, and category/tag listings and counts.
  Future-dated posts stay excluded until publish time.
- **Draft post visibility gate.** A post is considered draft (invisible
  to the public) when `published=false` OR `publishedRevisionId=null`.
  All public queries MUST check both conditions. A post with
  `published=true` but no published revision must NOT appear on the home
  page, in listings, feeds, or sitemap.

## Page draft preview

- `routes/public/page/detail.tsx` paints a red admin-only badge via
  `PageDetailBody`'s `draftMarker` prop.
- Catalog miss → anonymous 404, admin sees latest draft with **【草稿】**.
- Catalog hit + `?draft=true` → anonymous ignores; admin sees overlay
  with **【未发布的草稿】** (newer draft exists) or **【已发布的草稿】**
  (latest revision IS the published one).
- Discriminator:
  `'draft' | 'unpublished-draft' | 'published-draft' | null`.
  Service is `loadPageDraftPreviewBySlug` returning
  `{ page, hasNewerDraft }`.
