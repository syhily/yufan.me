# AGENTS.md

Repository conventions for AI agents and contributors. Read this before
authoring or refactoring templates.

## Stack

- Astro 6 framework, router, MDX/asset pipeline, session, actions.
- React 19 as the view layer. All UI templates are TSX **async server
  components** — zero client JS by default.
- `@astrojs/react` integration wired globally (see `astro.config.ts`).

## File layout

- `src/pages/**/*.astro` — thin **route shells** (~3–10 lines). Read
  `Astro.params/session/url/locals`, handle `Astro.redirect/rewrite`, compute
  data, then hand everything off to a `<PageBody.tsx />`.
- `src/layouts/BaseLayout.astro`, `src/layouts/AdminLayout.astro` — own the
  full `<!doctype><html><head><body>` document and side-effect-import global
  CSS. Each has a sibling `*.tsx` (`BaseLayout.tsx` / `AdminLayout.tsx`)
  rendering the inner body chrome.
- `src/components/**/*.tsx` — **every component** (partials, sidebar widgets,
  comments tree, SEO meta, pagination, post cards, MDX wrappers, admin cards).
- `src/components/**/*Partial.astro` — tiny wrappers that forward props into
  TSX components so `actions/*.ts` can call
  `AstroContainer.renderToString(...)` on them. Examples:
  `CommentPartial.astro`, `CommentItemPartial.astro`,
  `AdminCommentListPartial.astro`.
- `src/components/page/post/PostContent.astro` — kept as `.astro` because it
  invokes `await post.render()` and `<Content components={…}/>` (MDX output
  can only live inside Astro components).

## Translation rules (Astro → TSX)

| Astro | TSX |
| --- | --- |
| `Astro.props` | React function arguments |
| default `<slot />` | `{children}` |
| `<slot name="og">` | named prop, e.g. `og?: ReactNode` / `headExtra?: ReactNode` |
| `<Fragment set:html={x} />` | `<Html html={x} as="span"\|"div" />` or inline `dangerouslySetInnerHTML` |
| `class="..."` (on a TSX component) | `className="..."` — `@astrojs/react` drops `class` |
| `class:list={[…]}` | `cx(...)` helper at `src/components/ui/cx.ts` |
| `Astro.self` recursion | recurse by component name |
| `<Image />` from `astro:assets` | `<AstroImage />` (`src/components/ui/AstroImage.tsx`) |
| inline SVG via `experimental.svg` | `<Icon name="..." />` (`src/components/icons/Icon.tsx`) |
| `Astro.redirect/rewrite/response.status/session` | stays in the `.astro` shell only |
| `<Content components={…}/>` | stays in the `.astro` shell; pass body as `children` |

## Client interactivity

- Default: server-only. Do not add `client:*`.
- Add `client:load` / `client:visible` / `client:idle` **only** when the
  component genuinely needs hydration.
- Per-route client scripts live as `<script>import '…';</script>` blocks in
  the surviving `.astro` shell (e.g. `global`, `admin/manage`, `admin/login`,
  `admin/install`).

## Actions + SSR partials

- `src/actions/*.ts` uses `partialRender(Component, { props, request })` from
  `src/services/markdown/render.ts`. The container loads both the MDX and
  React renderers, so partials can themselves render TSX components.
- To render a TSX component from an action, create a tiny `*Partial.astro`
  wrapper that forwards props. Do not pass TSX component factories to
  `partialRender` directly.

## Formatting / lint

- `.tsx`/`.ts` are formatted with `oxfmt` and linted with `oxlint`.
- `.astro` is formatted with `prettier` + `prettier-plugin-astro`.
- `lint-staged` (see `package.json`) runs both pipelines automatically.

## Build + check commands

- `npm run dev` — Astro dev server.
- `npm run build` — full production build. The post-build `astro-uploader`
  S3 hook fails locally when S3 env vars are missing; that error is
  unrelated to the Astro/React build.
- `npx astro check` — type-checks `.astro` files (Astro-aware diagnostics).
- `npx astro sync` — regenerates `.astro/` types when Astro-specific types
  drift.

## Editing guidance

- Prefer editing an existing component over creating a new one.
- Never leave an orphan `.astro` duplicate of a TSX component. If you create
  `Foo.tsx`, delete `Foo.astro` (Astro is case-insensitive on macOS file
  resolution and will pick the wrong one).
- Keep MDX-specific code (`await post.render()`, `<Content />`) inside the
  page shell. Push everything else into TSX.
