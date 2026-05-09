import { sql } from 'drizzle-orm'
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { randomUUID } from 'node:crypto'

// Per-page metric counters keyed on the canonical permalink (`key`).
// One row per public URL the like / view / comment-count widgets need
// to track. Counters move with single-row UPDATEs from the comment +
// like flows, so the table stays narrow on purpose — denormalised
// `title` and the soft-delete column are retained because the
// comment-moderation list (`@/server/db/query/comment.ts`) joins back
// to surface a friendly "post title" next to each pending row without
// hitting the in-memory catalog.
export const metric = pgTable(
  'metric',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    key: varchar('key', { length: 255 }).unique().notNull(),
    title: text('title').notNull(),
    voteUp: bigint('vote_up', { mode: 'number' }),
    voteDown: bigint('vote_down', { mode: 'number' }),
    pv: bigint('pv', { mode: 'number' }),
  },
  (table) => [index('idx_metric_key').on(table.key), index('idx_metric_deleted_at').on(table.deletedAt)],
)

export const like = pgTable(
  'like',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).$defaultFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    token: varchar('token', { length: 255 }),
    pageKey: varchar('page_key', { length: 255 }),
  },
  (table) => [index('idx_like_token').on(table.token)],
)

export const comment = pgTable(
  'comment',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    content: text('content').default(''),
    pageKey: varchar('page_key', { length: 255 }).notNull(),
    userId: bigint('user_id', { mode: 'bigint' }).notNull(),
    isVerified: boolean('is_verified').default(false),
    ua: text('ua'),
    ip: text('ip'),
    rid: bigint('rid', { mode: 'number' }).notNull().default(0),
    isCollapsed: boolean('is_collapsed').default(false),
    isPending: boolean('is_pending').default(false),
    isPinned: boolean('is_pinned').default(false),
    voteUp: bigint('vote_up', { mode: 'number' }),
    voteDown: bigint('vote_down', { mode: 'number' }),
    rootId: bigint('root_id', { mode: 'bigint' }),
  },
  (table) => [
    index('idx_comment_root_id').on(table.rootId),
    index('idx_comment_rid').on(table.rid),
    index('idx_comment_user_id').on(table.userId),
    index('idx_comment_page_key').on(table.pageKey),
    index('idx_comment_deleted_at').on(table.deletedAt),
  ],
)

export const user = pgTable(
  'user',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).unique().notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    link: text('link'),
    password: text('password').notNull(),
    badgeName: text('badge_name'),
    badgeColor: text('badge_color'),
    // Optional manual override for the badge text colour. When `null`
    // (the historical default for every existing row) the public
    // renderer falls back to `commentBadgeTextColor()`'s WCAG-based
    // auto-pick so older accounts keep working without an admin sweep.
    badgeTextColor: text('badge_text_color'),
    lastIp: text('last_ip'),
    lastUa: text('last_ua'),
    isAdmin: boolean('is_admin').default(false),
    isMuted: boolean('is_muted').default(false).notNull(),
    receiveEmail: boolean('receive_email').default(true),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_name').on(table.name),
    index('idx_users_deleted_at').on(table.deletedAt),
  ],
)

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
})

// Friendly link entries shown by the `<Friends />` MDX component on
// `/links`. Migrated from the historical `friends.yaml` so admins can
// edit the list (CRUD + temporary hide) from `/wp-admin/friends`
// without redeploying the site.
//
// Field design:
// - No `slug`: the YAML's `slug` was an authoring shorthand only — the
//   public renderer keys on `homepage` and the admin shell keys on
//   `id`, neither of which needs a separate handle.
// - No `sortOrder`: friends render in random order
//   (`@/ui/mdx/page/Friends.tsx` already shuffles), so no ranking is
//   stored. Admin list sorts by `createdAt desc` (newest first).
// - Soft-uniqueness on `homepage` is enforced at the service layer
//   (CLI import + admin upsert): a strict DB UNIQUE would reject
//   protocol/trailing-slash variants the editor probably meant as
//   updates.
export const friend = pgTable(
  'friend',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    website: varchar('website', { length: 80 }).notNull(),
    description: text('description'),
    homepage: text('homepage').notNull(),
    poster: text('poster').notNull(),
    rssUrl: text('rss_url'),
    visible: boolean('visible').default(true).notNull(),
  },
  (table) => [index('idx_friend_visible').on(table.visible), index('idx_friend_homepage').on(table.homepage)],
)

// Post category. Migrated from the historical `categories.yaml` so
// admins can edit the list (CRUD) from `/wp-admin/categories` without
// redeploying the site. The MDX frontmatter still references a
// category by its `name` (the natural key surfaced to authors), so
// `name` is `UNIQUE`. `slug` drives the public `/cats/:slug` URL and
// is also `UNIQUE`. `sort_order` lets admins control the listing
// order on `/categories` without an extra drag handle on every row.
//
// Counters (`counts` on the public DTO) stay derived in
// `ContentCatalog` from the post bucket — they are NOT stored here so
// a hot post's likes/views/comments churn never write-amplifies the
// taxonomy table.
export const category = pgTable(
  'category',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    name: varchar('name', { length: 20 }).unique().notNull(),
    slug: varchar('slug', { length: 80 }).unique().notNull(),
    cover: text('cover').notNull(),
    description: text('description').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [index('idx_category_slug').on(table.slug), index('idx_category_sort_order').on(table.sortOrder)],
)

// Post tag. Migrated from the historical `tags.yaml` so admins can
// edit the list (CRUD) from `/wp-admin/tags` without redeploying the
// site. As with `category`, the MDX frontmatter references a tag by
// its `name` so the `UNIQUE (name)` is the integrity invariant; the
// `slug` drives `/tags/:slug` and is also `UNIQUE`.
export const tag = pgTable(
  'tag',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    name: varchar('name', { length: 20 }).unique().notNull(),
    slug: varchar('slug', { length: 80 }).unique().notNull(),
  },
  (table) => [index('idx_tag_slug').on(table.slug)],
)

// Image library backing the admin "图片管理" surface.
//
// Every row represents an object uploaded through the admin panel
// into the configured S3-compatible bucket; `storagePath` is the S3
// object key (e.g. `images/2026/05/2026050214321999.jpg`,
// `images/categories/<slug>.jpg`, `images/links/<host>.jpg`) and the
// public URL is `<publicBaseUrl>/<storagePath>` at runtime.
//
// `width` / `height` / `byteSize` are populated from the upload
// pipeline (sharp metadata after the JPEG re-encode); `thumbhash` is
// a base64 string consumed by the runtime placeholder hook.
//
// `storagePath` is `UNIQUE` so the upload service can `ON CONFLICT
// DO UPDATE` on the state-keyed kinds (category / friend) without a
// pre-flight SELECT. The `kind=generic` upload always picks a
// timestamp key so it should not collide in practice; the unique
// constraint catches any pathological case loudly.
export const image = pgTable(
  'image',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    storagePath: varchar('storage_path', { length: 500 }).unique().notNull(),
    mimeType: varchar('mime_type', { length: 60 }).notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
    thumbhash: text('thumbhash'),
    uploaderId: bigint('uploader_id', { mode: 'bigint' }),
    note: text('note'),
  },
  (table) => [index('idx_image_created_at').on(table.createdAt), index('idx_image_deleted_at').on(table.deletedAt)],
)

// Music library backing the admin "音乐管理" surface and the
// `<MusicPlayer />` MDX component.
//
// Every row represents a song whose audio + cover have been
// downloaded from a third-party music provider (currently only
// `netease` via `@meting/core`) into the same S3 bucket the image
// library uses. Audio lives at `musics/<playerId>.mp3`, cover at
// `musics/<playerId>.jpg` (300×300 JPEG re-encoded by `sharp`).
//
// Key shape:
// - `(source, sourceId)` is the business unique key. `source` is a
//   varchar instead of an enum so future providers (tencent, kugou,
//   …) only require an application-layer change. `sourceId` is the
//   provider-side song id.
// - `playerId` is a 16-char `[a-z0-9]` opaque handle generated server-
//   side (collision-retry once). It is what MDX writes:
//   `<MusicPlayer id="7hk2pqrxyzabc012" />` and what the public GET
//   API keys on. Decoupling it from `sourceId` means the public URL
//   does not leak the provider id and a future provider switch will
//   not invalidate the MDX corpus.
// - `audioStoragePath` / `coverStoragePath` are unique S3 keys, so
//   re-importing the same song is a hard constraint violation rather
//   than silent overwrite.
// - `lyric` stores the raw LRC text inline so the public GET API can
//   return audio + cover URL + lyric in a single query.
export const music = pgTable(
  'music',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    source: varchar('source', { length: 20 }).notNull(),
    sourceId: varchar('source_id', { length: 64 }).notNull(),
    playerId: varchar('player_id', { length: 16 }).unique().notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    artist: varchar('artist', { length: 200 }).notNull(),
    album: varchar('album', { length: 200 }).notNull(),
    audioStoragePath: varchar('audio_storage_path', { length: 500 }).unique().notNull(),
    coverStoragePath: varchar('cover_storage_path', { length: 500 }).unique().notNull(),
    lyric: text('lyric'),
    uploaderId: bigint('uploader_id', { mode: 'bigint' }),
  },
  (table) => [
    uniqueIndex('uq_music_source_source_id').on(table.source, table.sourceId),
    index('idx_music_player_id').on(table.playerId),
    index('idx_music_created_at').on(table.createdAt),
    index('idx_music_deleted_at').on(table.deletedAt),
  ],
)

// Page business-identity table. Owns one row per page (about / links /
// guestbook / …) and, for each row, the metadata an admin edits in
// the right-hand "metadata" panel of the editor. The actual
// PortableText body and its history live in the shared `content`
// table below — `page` only points to the currently-published
// revision via `published_revision_id`.
//
// Field design rationale:
// - `slug` drives the public `/:slug` URL (varchar(80) is the same
//   ceiling enforced on category/tag slugs and is plenty for human-
//   chosen handles like `about` / `friends` / `guestbook`).
//
//   IMPORTANT: page slugs share **a single global namespace** with
//   post slugs (`src/content/posts/**/*.mdx` frontmatter `slug` plus
//   the `alias[]` aliases). Even though
//   the routes physically separate them (`/posts/:slug` vs
//   `/:slug`), every catalog-side lookup —
//   `getCatalog().getPost(slug) ?? getCatalog().getPage(slug)`,
//   the `images/og/:slug.png` resolver, the comment thread keyed
//   on the permalink — relies on the slug being unique across the
//   union. The DB-level `UNIQUE(slug)` here only enforces
//   page↔page; the cross-table page↔post invariant is fenced at
//   catalog cold start by `validatePageSlugs` (see
//   `@/server/catalog/catalog`), which throws and refuses to boot
//   the server when the union has a duplicate. Operators trying to
//   create a colliding page therefore see the failure on the next
//   catalog rebuild rather than at save time — keep this in mind
//   when adding new slug emitters anywhere in the codebase.
// - `title` / `summary` / `cover` / `og` are the same surface the
//   catalog has historically projected from MDX frontmatter —
//   keeping them on the meta row means listing pages and feeds never
//   need to join `content`.
// - `published` / `comments_enabled` / `show_toc` are boolean toggles
//   the admin flips without writing a new revision (these are
//   metadata, not body), so they live on `page` rather than
//   `content`.
// - `published_at` is the canonical "first published" timestamp shown
//   in the public footer / `<time>`. It defaults to the row's create
//   time if the operator forgets to set it explicitly.
// - `published_revision_id` is a foreign key into `content.id`. NULL
//   means "never published yet" — the public catalog hides such
//   rows. We deliberately don't enforce the FK in DDL because the
//   runtime guarantees ordering (`content` row exists before
//   `page.published_revision_id` is updated to point at it within
//   the same transaction).
// - `deleted_at` follows the soft-delete convention used by every
//   other long-lived row (friend / image / music).
//   `/wp-admin/pages/restore` flips it back to NULL.
export const page = pgTable(
  'page',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    slug: varchar('slug', { length: 80 }).unique().notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    summary: text('summary').notNull().default(''),
    cover: text('cover').notNull().default(''),
    og: text('og'),
    published: boolean('published').notNull().default(true),
    commentsEnabled: boolean('comments_enabled').notNull().default(true),
    showToc: boolean('show_toc').notNull().default(false),
    // When true the public detail route appends the global friends
    // grid (the same grid the legacy `<Friends />` MDX component
    // rendered) at the bottom of the page body. Driven by a meta
    // toggle in the editor's right sidebar so the operator doesn't
    // have to re-publish the body just to turn the section on/off.
    // Defaults to false because most pages (about, single-purpose
    // landing pages) don't want the grid; the `links` page is the
    // canonical opt-in.
    showFriends: boolean('show_friends').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    publishedRevisionId: bigint('published_revision_id', { mode: 'bigint' }),
  },
  (table) => [index('idx_page_slug').on(table.slug), index('idx_page_deleted_at').on(table.deletedAt)],
)

// Shared revision repository for both pages and (eventually) posts.
//
// Why a single shared table instead of `page_revision` / `post_revision`?
// 1. PortableText body shape is identical between the two; splitting
//    forces two near-identical projections.
// 2. The editor save/publish state machine is also identical (draft
//    branches off the latest revision, publish promotes one row).
// 3. Cross-content features added later — e.g. "where is image X
//    embedded?" or "global trash bin" — are a single index scan on
//    `content` instead of a UNION of two history tables.
//
// Discriminator pair `(type, owner_id)`:
// - `type` is `'page' | 'post'` (no DB enum — keep it varchar so a
//   future `'note'` / `'snippet'` doesn't require a `pg_enum_add`
//   migration).
// - `owner_id` references `page.id` when type='page' and (in the
//   future) the corresponding `post.id`. The FK is **not** enforced
//   in DDL: a polymorphic FK isn't expressible without a CHECK +
//   trigger pair, and the application layer guarantees the invariant
//   inside transactions where it matters.
//
// Revision numbering:
// - `revision_no` is monotonically increasing **per (type, owner_id)**.
//   The unique index `uq_content_owner_revision` enforces no two
//   revisions of the same owner share a number; the service layer
//   acquires `SELECT … FOR UPDATE` on the page row before computing
//   `MAX(revision_no) + 1` so concurrent saves serialise correctly.
//
// Status:
// - `'draft'` is the in-progress revision the editor writes back to
//   on every autosave; `'published'` is immutable and exactly one row
//   per owner is referenced by `page.published_revision_id` at any
//   given time. The transition is one-way (publishing a draft flips
//   it to `'published'`; further edits create a new draft on top).
//
// Optimistic concurrency:
// - `client_revision_token` is a UUID rotated on every server-side
//   write. The editor sends the token it last received; the service
//   layer rejects writes whose token doesn't match the row's current
//   token, surfacing a "conflict, choose a side" diff in the UI.
//
// Snapshot fields:
// - `body` is the canonical PortableText (`PortableTextBlock[]`)
//   payload. Validated by `@/shared/portable-text` at the API
//   perimeter so a malformed payload never lands.
// - `image_sources` is the array of S3 storagePath values referenced
//   by the body, denormalised so the SSR enhancer can resolve
//   thumbhashes in a single `WHERE storage_path IN (…)` lookup
//   without re-walking the body tree.
// - `headings` is the structured TOC array (`{depth, text, slug}[]`),
//   pre-computed at save time so SSR doesn't re-parse PortableText
//   to render the right-hand TOC widget.
// - `author_id` records who saved the revision (NULL only for the
//   migration script that backfills the initial publication).
export const content = pgTable(
  'content',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    type: varchar('type', { length: 16 }).notNull(),
    ownerId: bigint('owner_id', { mode: 'bigint' }).notNull(),
    revisionNo: integer('revision_no').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    body: jsonb('body')
      .notNull()
      .default(sql`'[]'::jsonb`),
    imageSources: jsonb('image_sources')
      .notNull()
      .default(sql`'[]'::jsonb`),
    headings: jsonb('headings')
      .notNull()
      .default(sql`'[]'::jsonb`),
    authorId: bigint('author_id', { mode: 'bigint' }),
    clientRevisionToken: uuid('client_revision_token')
      .notNull()
      .$defaultFn(() => randomUUID()),
  },
  (table) => [
    uniqueIndex('uq_content_owner_revision').on(table.type, table.ownerId, table.revisionNo),
    index('idx_content_owner_status').on(table.type, table.ownerId, table.status),
    index('idx_content_status').on(table.status),
  ],
)

// Section-scoped store for the editable blog configuration. One row per
// `scope`; the admin panel writes one row per settings section, named
// `blog.<section>` (e.g. `blog.general`, `blog.assets`,
// `blog.mail`, …). Splitting the previously-singleton `blog` row this
// way means a save to one section never reads, merges, or rewrites the
// JSONB belonging to any other section, so concurrent edits on
// different tabs cannot race each other. The full snapshot is
// reassembled in memory by `hydrateBlogSettings()` via a single
// `WHERE scope LIKE 'blog.%'` SELECT.
export const setting = pgTable('setting', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
  scope: varchar('scope', { length: 64 }).unique().notNull().default('blog'),
  data: jsonb('data')
    .notNull()
    .default(sql`'{}'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedBy: bigint('updated_by', { mode: 'bigint' }),
})
