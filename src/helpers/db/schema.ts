import { bigint, bigserial, boolean, index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const atk_pages = pgTable(
  'atk_pages',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    key: varchar('key', { length: 255 }),
    title: text('title'),
    admin_only: boolean('admin_only'),
    site_name: varchar('site_name', { length: 255 }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    vote_up: bigint('vote_up', { mode: 'number' }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    vote_down: bigint('vote_down', { mode: 'number' }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    pv: bigint('pv', { mode: 'number' }),
  },
  (table) => {
    return {
      idx_atk_pages_site_name: index('idx_atk_pages_site_name').on(table.site_name),
      idx_atk_pages_key: index('idx_atk_pages_key').on(table.key),
      idx_atk_pages_deleted_at: index('idx_atk_pages_deleted_at').on(table.deleted_at),
    };
  },
);

export const atk_likes = pgTable(
  'atk_likes',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    token: varchar('token', { length: 255 }),
    page_key: varchar('page_key', { length: 255 }),
  },
  (table) => {
    return {
      idx_atk_likes_token: index('idx_atk_likes_token').on(table.token),
    };
  },
);

export const atk_users = pgTable(
  'atk_users',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    name: varchar('name', { length: 255 }),
    email: varchar('email', { length: 255 }),
    link: text('link'),
    password: text('password'),
    badge_name: text('badge_name'),
    badge_color: text('badge_color'),
    last_ip: text('last_ip'),
    last_ua: text('last_ua'),
    is_admin: boolean('is_admin'),
    receive_email: boolean('receive_email').default(true),
    token_valid_from: timestamp('token_valid_from', { withTimezone: true, mode: 'date' }),
    is_in_conf: boolean('is_in_conf'),
  },
  (table) => {
    return {
      idx_atk_users_email: index('idx_atk_users_email').on(table.email),
      idx_atk_users_name: index('idx_atk_users_name').on(table.name),
      idx_atk_users_deleted_at: index('idx_atk_users_deleted_at').on(table.deleted_at),
    };
  },
);

export const atk_comments = pgTable(
  'atk_comments',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    content: text('content'),
    page_key: varchar('page_key', { length: 255 }),
    site_name: varchar('site_name', { length: 255 }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    user_id: bigint('user_id', { mode: 'number' }),
    is_verified: boolean('is_verified').default(false),
    ua: text('ua'),
    ip: text('ip'),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    rid: bigint('rid', { mode: 'number' }),
    is_collapsed: boolean('is_collapsed').default(false),
    is_pending: boolean('is_pending').default(false),
    is_pinned: boolean('is_pinned').default(false),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    vote_up: bigint('vote_up', { mode: 'number' }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    vote_down: bigint('vote_down', { mode: 'number' }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    root_id: bigint('root_id', { mode: 'number' }),
  },
  (table) => {
    return {
      idx_atk_comments_root_id: index('idx_atk_comments_root_id').on(table.root_id),
      idx_atk_comments_rid: index('idx_atk_comments_rid').on(table.rid),
      idx_atk_comments_user_id: index('idx_atk_comments_user_id').on(table.user_id),
      idx_atk_comments_site_name: index('idx_atk_comments_site_name').on(table.site_name),
      idx_atk_comments_page_key: index('idx_atk_comments_page_key').on(table.page_key),
      idx_atk_comments_deleted_at: index('idx_atk_comments_deleted_at').on(table.deleted_at),
    };
  },
);
