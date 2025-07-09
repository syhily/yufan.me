import { bigint, bigserial, boolean, index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const page = pgTable(
  'page',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    key: varchar('key', { length: 255 }).unique().notNull(),
    title: text('title').notNull(),
    voteUp: bigint('vote_up', { mode: 'number' }),
    voteDown: bigint('vote_down', { mode: 'number' }),
    pv: bigint('pv', { mode: 'number' }),
  },
  table => [index('idx_page_key').on(table.key), index('idx_page_deleted_at').on(table.deletedAt)],
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
  table => [index('idx_like_token').on(table.token)],
)

export const comment = pgTable(
  'comment',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
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
  table => [
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
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).unique().notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    link: text('link'),
    password: text('password').notNull(),
    badgeName: text('badge_name'),
    badgeColor: text('badge_color'),
    lastIp: text('last_ip'),
    lastUa: text('last_ua'),
    isAdmin: boolean('is_admin').default(false),
    receiveEmail: boolean('receive_email').default(true),
  },
  table => [
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
  createdAt: timestamp('created_at').notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at').notNull().$defaultFn(() => new Date()),
})
