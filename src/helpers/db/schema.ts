import { bigint, bigserial, boolean, index, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

export const atk_sites = pgTable(
  'atk_sites',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    name: varchar('name', { length: 255 }),
    urls: text('urls'),
  },
  (table) => {
    return {
      idx_atk_sites_name: uniqueIndex('idx_atk_sites_name').on(table.name),
      idx_atk_sites_deleted_at: index('idx_atk_sites_deleted_at').on(table.deleted_at),
    };
  },
);

export const atk_pages = pgTable(
  'atk_pages',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
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

export const atk_users = pgTable(
  'atk_users',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
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
    token_valid_from: timestamp('token_valid_from', { withTimezone: true, mode: 'string' }),
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

export const atk_auth_identities = pgTable(
  'atk_auth_identities',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    provider: text('provider'),
    remote_uid: varchar('remote_uid', { length: 255 }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    user_id: bigint('user_id', { mode: 'number' }),
    token: text('token'),
    confirmed_at: timestamp('confirmed_at', { withTimezone: true, mode: 'string' }),
    expires_at: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => {
    return {
      idx_atk_auth_identities_remote_uid: index('idx_atk_auth_identities_remote_uid').on(table.remote_uid),
      idx_atk_auth_identities_deleted_at: index('idx_atk_auth_identities_deleted_at').on(table.deleted_at),
      idx_atk_auth_identities_user_id: index('idx_atk_auth_identities_user_id').on(table.user_id),
    };
  },
);

export const atk_user_email_verifies = pgTable(
  'atk_user_email_verifies',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    email: varchar('email', { length: 255 }),
    code: text('code'),
    expires_at: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    ip: text('ip'),
    ua: text('ua'),
  },
  (table) => {
    return {
      idx_atk_user_email_verifies_email: index('idx_atk_user_email_verifies_email').on(table.email),
      idx_atk_user_email_verifies_deleted_at: index('idx_atk_user_email_verifies_deleted_at').on(table.deleted_at),
    };
  },
);

export const atk_comments = pgTable(
  'atk_comments',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
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

export const atk_notifies = pgTable(
  'atk_notifies',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    user_id: bigint('user_id', { mode: 'number' }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    comment_id: bigint('comment_id', { mode: 'number' }),
    is_read: boolean('is_read'),
    read_at: timestamp('read_at', { withTimezone: true, mode: 'string' }),
    is_emailed: boolean('is_emailed'),
    email_at: timestamp('email_at', { withTimezone: true, mode: 'string' }),
    key: varchar('key', { length: 255 }),
  },
  (table) => {
    return {
      idx_atk_notifies_user_id: index('idx_atk_notifies_user_id').on(table.user_id),
      idx_atk_notifies_deleted_at: index('idx_atk_notifies_deleted_at').on(table.deleted_at),
      idx_atk_notifies_key: index('idx_atk_notifies_key').on(table.key),
      idx_atk_notifies_comment_id: index('idx_atk_notifies_comment_id').on(table.comment_id),
    };
  },
);

export const atk_votes = pgTable(
  'atk_votes',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    target_id: bigint('target_id', { mode: 'number' }),
    type: text('type'),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    user_id: bigint('user_id', { mode: 'number' }),
    ua: text('ua'),
    ip: text('ip'),
  },
  (table) => {
    return {
      idx_atk_votes_user_id: index('idx_atk_votes_user_id').on(table.user_id),
      idx_atk_votes_type: index('idx_atk_votes_type').on(table.type),
      idx_atk_votes_target_id: index('idx_atk_votes_target_id').on(table.target_id),
      idx_atk_votes_deleted_at: index('idx_atk_votes_deleted_at').on(table.deleted_at),
    };
  },
);
