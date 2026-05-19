# UI conventions

`src/ui/` contains pure-props React components. Components receive
explicit props. No reads from sessions, route params, request objects,
or env vars. State lives at the route module or the closest interactive
parent.

## Component tiers

- **`ui/components/`** — shadcn/ui primitives (Base UI variant), flat
  so `npx shadcn@latest add/diff` works. `components.json` aliases
  `components` and `ui` here. One token cascade in `:root`
  (`tailwind.css`) covers public + admin.
- **`ui/public/`** — `chrome/`, `post/`, `comments/`, `widgets/`, plus
  single-file leaves (`Search.tsx`, `Sidebar.tsx`, `LikeActions.tsx`).
- **`ui/admin/`** — grouped by domain (`analytics`, `auth`,
  `categories`, `comments`, `editor`, `editor-shell`, `friends`,
  `images`, `musics`, `my`, `pages`, `posts`, `sessions`, `settings`,
  `tags`, `users`, `dashboard`, plus `shared/` and `shell/`).
  - `editor/` — the Tiptap micro-app (`PageBodyEditor`, `tiptap/`,
    `toolbar/`, `pickers/`, `FootnoteEditorDialog`,
    `portable-text-diff`). Self-contained; only `PageBodyEditor` is
    imported by other admin domains.
  - `editor-shell/` — the business-orchestration layer that wraps the
    Tiptap editor into a draft/publish workflow:
    `useEditorShellState` (shared FSM for both Post + Page editor
    shells — body/meta drafts, draft-conflict resolution, autosave,
    revision-token race, persist save/publish/unpublish, keyboard
    shortcuts, layout toggles), `DraftConflictDialog`,
    `FloatingPublishButton`, `PreviewPanel`, `RevisionsDrawer`,
    `DateTimePicker`. `PostEditorShell.tsx` and `PageEditorShell.tsx`
    consume the hook + sub-components and stay thin (~500 LOC each)
    by encoding only their entity-specific bindings (DTO key shape,
    API endpoint paths, sidebar component, mutation payload fields,
    UI text). No new shared state belongs in either Shell — extend
    `useEditorShellState` instead.

## Cross-cutting UI modules

- `ui/pt/` — PortableText SSR renderer split across `render.tsx`
  (entry, components map, recursive blocks, FootnotesSection),
  `render-blocks.tsx` (12 block renderers + table inline-span
  helpers), `render-marks.tsx` (3 mark renderers +
  `renderMathMarkupOrTexFallback`), `render-shared.ts` (PT_INLINE
  class tokens + 4 React contexts). Plus `Footnotes.tsx`,
  `image-meta-context.tsx`, and custom-block components under
  `ui/pt/blocks/` (CodeBlock, BlockImage, MusicPlayer, Solution,
  Friends).
- `ui/icons/` — Static-export icon library. Named imports only — no
  `<Icon name="..." />` string lookups.
- `ui/lib/` — UI utilities (`cn`, `code-languages`, `ThemeProvider`,
  `blog-config-context`, `use-media-query`). shadcn's `aliases.lib` is
  pinned here. No `src/lib/` parallel.

## Component rules

- Plain TSX with explicit props. No hidden reads from route params,
  sessions, request objects, or env vars.
- Compose with children and slots, not boolean prop matrices
  (`architecture-avoid-boolean-props`).
- Prefer compound components over render-prop callbacks. Recursive
  components recurse by component name.
- React 19: no `forwardRef` for new components — refs flow through
  props.

## Styling rules

- Raw HTML uses `dangerouslySetInnerHTML` on the host element — no
  generic `Html` wrapper.
- Conditional classNames go through `cn()` from `@/ui/lib/cn`. It
  composes `clsx` with a project-customised `tailwind-merge` that
  registers every `@theme` token. Adding a new `--<namespace>-<name>`
  token in `tailwind.css` MUST be paired with an entry in `cn.ts`'s
  per-namespace list — enforced by
  `tests/contract.tailwind-tokens.test.ts`.
- Use `<Image />` from `@/ui/public/widgets/Image` for transformed
  remote images.

## LOC ceiling

Stateful orchestrators (editor shells, multi-stage forms, comment
threads, PortableText renderers) should aim for ≤500 LOC per file.
When a single file grows past that, extract: shared state into a hook,
reusable sub-components into siblings, or per-renderer modules. The
benchmark is "another agent can read and modify the file without
scrolling past unrelated concerns."

## PortableText editor

- Zod dialect: `@/shared/pt/schema` (text / list / heading / blockquote
  - custom blocks `image`, `code`, `mathBlock`, `mermaid`,
    `horizontalRule`, `musicPlayer`, `solution`, `footnoteDefinition`,
    `table`). Friends grid is NOT a body block — it's the
    `page.show_friends` toggle.
- Server-only PT helpers in `@/server/domains/pt/*` (prerender,
  canonicalize) must never reach the client bundle.
- PT ↔ ProseMirror bridge is `@/shared/pt/bridge` — single file. Custom
  blocks ride a generic `blockCard` PM node. Round-trip is
  contract-tested in `tests/contract.pt-bridge.test.ts`.
- SSR renderer is `@/ui/pt/render` (`PortableTextBody`), composing
  `@portabletext/react` with `@/ui/pt/blocks/*`. Heading anchor ids
  align with post anchors.
- Admin editor is `@/ui/admin/editor/PageBodyEditor` (shared by pages
  and posts). UX: toolbar (image library / music picker / link / table
  / hr / undo-redo) → `tiptap/BubbleMenu` (text selection: B/I/U +
  code + link + `mathInline`/`footnoteRef`) and
  `tiptap/TableBubbleMenu` (table selection), mutually exclusive →
  `tiptap/SlashMenu` (`@tiptap/suggestion`, catalogue in
  `tiptap/slash-commands.ts`; pickers dispatch `CustomEvent`s from
  `tiptap/editor-events.ts`).
- Image block uses a React NodeView (`tiptap/ImageNodeView`) for inline
  alt + caption edits.
- **Table dialect**: cells are inline-only — no nested blocks, lists,
  code blocks, math blocks, or footnote refs. Only `link` mark-defs.
  Slash-menu / toolbar inserts a 3×3 table with a header row.
- Floating popups anchor with `position: fixed` driven off the
  suggestion plugin's `clientRect` or Tiptap's `BubbleMenu` positioner.
  Do **not** add `@floating-ui/*` directly — `@base-ui/react` pulls it
  in transitively.

## Page draft preview

- `PageDetailBody` accepts a `draftMarker` prop:
  `'draft' | 'unpublished-draft' | 'published-draft' | null`.
- **【草稿】** — catalog miss, admin sees latest draft.
- **【未发布的草稿】** — catalog hit + `?draft=true`, newer draft exists.
- **【已发布的草稿】** — catalog hit + `?draft=true`, latest revision IS
  the published one.

## Page meta toggles

- `page` carries operator-facing booleans (`comments_enabled`,
  `show_toc`, `show_friends`) edited from `MetaSidebar` and consumed by
  `routes/public/page/detail.tsx` as render-time branches — never body
  mutations. `show_friends` appends the global friends grid below the
  body before the Like button; PortableText has no `friends` block.
- Adding a toggle touches: db schema + migration + snapshot, page
  projection, page service + schema, shared DTOs,
  `MetaSidebar` + `PageEditorShell`, and the `CreateDraftMeta` mirror
  in `@/client/hooks/use-create-page-draft`. Test fixtures in
  `tests/_helpers/catalog.ts` + `tests/service.cms-pages*.test.ts` need
  the new default.
