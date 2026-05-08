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
  varchar,
} from 'drizzle-orm/pg-core'

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
    key: varchar('key', { length: 255 }).unique().notNull(),
    title: text('title').notNull(),
    voteUp: bigint('vote_up', { mode: 'number' }),
    voteDown: bigint('vote_down', { mode: 'number' }),
    pv: bigint('pv', { mode: 'number' }),
  },
  (table) => [index('idx_page_key').on(table.key), index('idx_page_deleted_at').on(table.deletedAt)],
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
