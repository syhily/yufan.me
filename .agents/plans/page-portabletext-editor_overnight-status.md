# Overnight progress note — 2026-05-09

Branch: `feature/editor` — pushed.

## What landed (6 commits since the plan)

1. **`a4d5482` feat(db): add `doc` + `content` tables and rename `page` query layer to `metric`**
   - `schema.ts` gets `doc` (page metadata) and `content` (PortableText
     revisions) tables. Drizzle migration generated.
   - `src/server/db/query/page.ts` → `metric.ts`. Function renames
     contained to that file plus three direct callers
     (`comments/loader`, `comments/likes`, `metrics/batcher`). The
     business-side `pageKey` / `bumpPageView` vocabulary is unchanged
     per the user's "scope-a-minimal" choice — only the
     query/table-adjacent identifiers moved.
   - `tests/_helpers/db.ts` `seedPage` → `seedMetric`. All tests green.

2. **`6348fd0` feat(shared): define repo-local PortableText dialect**
   - `src/shared/portable-text.ts` declares the closed dialect
     (`block`, `image`, `code`, `mathBlock`, `mermaid`,
     `horizontalRule`, `musicPlayer`, `solution`, `friends`,
     `footnoteDefinition`) plus marks (`link`, `mathInline`,
     `footnoteRef`). One-deep recursion via `NonRecursiveBlock`
     to keep Zod + TS happy.
   - `collectHeadings` uses `github-slugger` so heading anchors stay
     stable across the future MDX → PT migration.
   - 14-case contract test in `tests/contract.portable-text.test.ts`.

3. **`95952a3` feat(cms): page repository + projection + service layer**
   - `src/server/cms/pages/repository.ts`: `saveDraftRevision` and
     `publishLatestRevision` state machines with `FOR UPDATE` row lock
     and `clientRevisionToken` optimistic concurrency.
   - `projection.ts`: `CmsPage` (public catalog), `AdminPageDto`,
     `AdminRevisionDto`, `AdminPageDetailDto`. Safe `jsonb` readers.
   - `service.ts`: slug legality + reserved-slug guard, body validation,
     `ActionFailure` surfacing, conflict translation.
   - `tests/service.cms-pages.test.ts`: 18 cases, all green.

4. **`28ae56e` feat(cms): admin API actions for the page editor**
   - 9 resource routes: `listPages`, `getPage`, `upsertPageMeta`,
     `deletePage`, `restorePage`, `listPageRevisions`, `saveDraft`,
     `publishLatest`, `previewPage`.
   - Schemas in `src/server/cms/pages/schema.ts`. Wire DTOs in
     `src/shared/cms-pages.ts`.
   - `previewPage` ships a tree-shake-friendly inline HTML renderer
     (`src/server/cms/pages/preview.ts`) so the wire contract
     (`{ html, headings }`) is stable. The full SSR PortableText
     renderer (math/mermaid/shiki/music) lands later.

5. **`6696386` feat(admin): /wp-admin/pages list view**
   - `PagesView` + `EditPageDialog` + `usePagesController`.
   - Status badges: 已发布 / 仅草稿 / 未发布 / 已删除.
   - Per-row actions: 新窗口预览, 编辑内容 (links to
     `/wp-admin/pages/:id/edit` — route doesn't exist yet, see TODO),
     编辑元数据 (dialog), 删除 (soft-delete confirm), 恢复 (for deleted rows).
   - AdminShell sidebar gains a "页面管理" entry.

6. **`<latest>` feat(editor): PortableText ↔ ProseMirror bridge**
   - `src/shared/pt-bridge.ts` translates between PT body and PM
     `doc` JSON. Round-trips the standard subset
     (text/marks/lists/headings/blockquote/code/image/horizontalRule)
     and passes custom blocks (musicPlayer/solution/mathBlock/mermaid/
     friends/footnoteDefinition) through opaquely via a generic
     `blockCard` PM node carrying the original payload.
   - 12 contract tests in `tests/contract.pt-bridge.test.ts`.
   - Tiptap deps installed (`@tiptap/core`, `@tiptap/react`,
     `@tiptap/starter-kit`, `@tiptap/extension-link`,
     `@tiptap/extension-placeholder`).

## Validation

- `vp check` — pass (formatting + lint + types green)
- `vp test run` — 654 / 654 tests passing across 88 files
- `vp build` — pass (server + client bundles)

## What's NOT built yet (remaining plan items)

In rough priority order:

1. **`/wp-admin/pages/:id/edit` route + Tiptap editor shell**.
   Tiptap deps already installed. Wire `useEditor({ content:
bodyToPmDoc(...) })` and on save call `pmDocToBody(editor.getJSON())`
   then POST through `API_ACTIONS.admin.saveDraft`.

2. **Tiptap node specs** for the 6 custom block types so the editor
   has rich UI (vs the bridge's opaque `blockCard` pass-through).
   Order of priority: musicPlayer → mathBlock/mathInline → mermaid →
   solution → friends → footnoteDefinition.

3. **Autosave + LocalStorage draft + diff view**:
   - 5 s debounce + 60 s hard cap.
   - `visibilitychange` and `pagehide` force-flush.
   - LS key shape: `cms-page-draft:<id>:<clientRevisionToken>`.
   - On open, compare LS draft with server's latest revision; on
     mismatch, render a side-by-side diff and let the admin pick.

4. **`<PortableTextBody>` SSR renderer** (`src/ui/portable-text/`):
   reuse `@/ui/mdx/*` components for math/mermaid/shiki/music/friends
   so the public detail route renders DB-backed bodies byte-for-byte
   like the MDX path. Once shipped, swap `previewPage` to use it.

5. **Catalog migration**: teach `ContentCatalog` to merge `doc`-rows
   on top of MDX pages. Initial cut should keep the MDX `pages/`
   collection live so existing pages don't break; remove
   `src/content/pages/` only after all live pages are mirrored into
   the DB.

6. **Image/Music picker dialogs** for the editor (reuse
   `admin.listImages`/`admin.uploadImage` and
   `admin.listMusic`/`admin.searchMusic`/`admin.addMusic`).

7. **Revision history drawer** in the right pane
   (`admin.listPageRevisions` is already wired).

## Decisions made overnight without input

- The `/wp-admin/pages/:id/edit` URL convention was chosen unilaterally
  — `Pages list view` already links to it. Easy to rename (one
  template literal in `PagesView.tsx`).
- `previewPage` ships a temporary inline renderer rather than waiting
  for the full SSR component. The wire shape is `{ html, headings }`
  so swapping the renderer under the route is a one-file change.
- The catalog migration was deferred entirely to a later commit so
  this branch never breaks the public site. The new `doc` rows are
  invisible to public routes until that migration lands.

## How to resume

```bash
git checkout feature/editor
vp test run        # baseline: 642 passing
# → next file to write: src/shared/pt-bridge.ts
```

## Day-2 update (2026-05-09 4:30 AM)

All seven "not built yet" items above have landed on
`feature/editor` since this note was written. Snapshot of where the
plan stands now:

- `/wp-admin/pages/:id/edit` is a full-page route with a split-pane
  layout — editor on the left, metadata + revision history drawer on
  the right, optional 实时预览 column wedged between them with the
  admin chrome auto-collapsing while it's open.
- Tiptap node specs cover image / music / math (inline + block) /
  mermaid / solution / friends / footnoteRef / footnoteDef /
  codeBlock. `mathBlock`, `mermaid`, and `solution` labels are
  inline-editable through a small `CardSourceEditor` panel inside
  the `BlockCardNode`.
- Autosave fires on a 5s debounce / 60s hard cap with three-tier
  retry (1s/3s/9s) and a "本地已保留" terminal state. LS draft is
  versioned, schemaVersion-mismatch is wiped, and cross-tab
  `clearDraft` events ride a `BroadcastChannel` + `storage`
  fallback. `DraftConflictDialog` uses `diff-match-patch` for
  char-level highlights and emits a `force_overwrite_save` audit
  event when the user picks "use local".
- `<PortableTextBody>` SSR renderer ships under `src/ui/portable-text/`
  and `page.detail.tsx` switches to it when the catalog returns a
  `source: 'db'` page. `admin.previewPage` reuses the same renderer
  via `renderToStaticMarkup`.
- `ContentCatalog` now merges DB-backed pages on top of the legacy
  MDX `pages/` collection (DB wins on slug clashes). Catalog
  visibility filter also gates on `publishedAt <= now()` so
  scheduled pages stay hidden.
- Revision history drawer expanded into a master-detail diff view
  with an "选择此版本" adopt button.
- Image / music pickers reused the existing admin endpoints; the
  Cover/OG fields in the metadata sidebar got a thumbnail preview +
  library picker + clear button.
- Published / unpublished / scheduled / live-with-draft-ahead is a
  proper state machine surfaced both in the toolbar badge and the
  sidebar's 基本信息 card. The toolbar's 发布 button switches its
  label to 计划发布 when `meta.publishedAt` is in the future.
- Tests: PT round-trip, validatePortableText contract, save/publish
  state machine, /:slug DB-source integration, snapshot fixtures,
  and `portable-text-diff` pure-function units are all in tree
  (`vp test run` is 92 / 92 files, 690 / 690 tests). Autosave / LS
  hook unit tests stay deferred — `environment: 'node'` doesn't
  ship a DOM, so adding them is a separate "wire jsdom/happy-dom"
  follow-up rather than part of this plan.
