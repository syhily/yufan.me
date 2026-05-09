-- Cross-rename to align the physical table names with the business
-- names that the code already speaks in.
--
-- Before this migration:
--   * `page`   : per-permalink metric counters (vote_up / pv / …),
--                with a denormalised `title` JOIN'd by the
--                comment-moderation list.
--   * `doc`    : page metadata (slug / title / published_at / …)
--                whose physical name was a placeholder because `page`
--                was already taken by the metric table above.
--
-- After this migration:
--   * `metric` : the metric counter table (was `page`). Same column
--                layout — only the table identifier and the two
--                indexes change name.
--   * `page`   : the page metadata table (was `doc`). Same column
--                layout — only the table identifier and the two
--                indexes change name.
--
-- The rename uses a single `DO $$ … $$` block so PostgreSQL applies
-- it atomically: there is no window in which both tables would carry
-- the same name (which would otherwise trip an "already exists"
-- error on the second rename if the migrator ever crashed mid-step).
--
-- Index renames matter because PostgreSQL keeps the historical
-- identifiers literal, and our schema.ts now references the new
-- names (`idx_metric_key`, `idx_metric_deleted_at`, `idx_page_slug`,
-- `idx_page_deleted_at`). A future `drizzle-kit generate` would
-- otherwise produce a DROP/CREATE pair on every diff because the
-- physical names disagree with the schema.
--
-- Index ORDER matters: the old metric table owned `idx_page_deleted_at`
-- and the new page (formerly `doc`) wants the SAME identifier. We
-- rename the old metric's `idx_page_deleted_at` -> `idx_metric_deleted_at`
-- BEFORE renaming `idx_doc_deleted_at` -> `idx_page_deleted_at`, so
-- the target slot is free at every step.
--
-- `IF EXISTS` is used on indexes to keep the migration idempotent
-- across deployments that may have already partially-applied this
-- transition out of band, and for fresh installs that won't have the
-- legacy indexes at all (the bootstrap flow runs every migration in
-- order from `init_schema`).

DO $$
BEGIN
  -- 1. Rename the metric table's indexes / constraints BEFORE
  --    renaming any table. The `idx_page_deleted_at` slot must be
  --    vacated before the page-meta table tries to claim it (step 4
  --    below). The PK / UNIQUE constraint identifiers must also be
  --    moved here so the snapshot stays internally consistent (a
  --    `RENAME TABLE` does NOT cascade-rename indexes / constraints
  --    in PostgreSQL).
  ALTER INDEX IF EXISTS "idx_page_key"        RENAME TO "idx_metric_key";
  ALTER INDEX IF EXISTS "idx_page_deleted_at" RENAME TO "idx_metric_deleted_at";
  -- `page_key_unique` was the explicit name supplied in the original
  -- init_schema migration. It moves with the constraint to its new
  -- table.
  ALTER INDEX IF EXISTS "page_key_unique"     RENAME TO "metric_key_unique";
  ALTER INDEX IF EXISTS "page_pkey"           RENAME TO "metric_pkey";

  -- 2. Rename the metric table itself. After this, the `page`
  --    identifier is free for the page-meta table to take.
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'page' AND relkind = 'r'
      AND relnamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "page" RENAME TO "metric";
  END IF;

  -- 3. Rename the page-meta table.
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'doc' AND relkind = 'r'
      AND relnamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "doc" RENAME TO "page";
  END IF;

  -- 4. Rename the page-meta table's indexes / constraints. Both
  --    `idx_page_deleted_at` and `page_pkey` were vacated by step 1,
  --    so this step cannot collide.
  ALTER INDEX IF EXISTS "idx_doc_slug"        RENAME TO "idx_page_slug";
  ALTER INDEX IF EXISTS "idx_doc_deleted_at"  RENAME TO "idx_page_deleted_at";
  -- `doc.slug` was created with column-inline `UNIQUE`, which lets
  -- PostgreSQL pick the default `doc_slug_key` identifier. The
  -- post-rename equivalent is `page_slug_key`. We do NOT promote it
  -- to `page_slug_unique` (the would-be `unique().notNull()` style)
  -- so the snapshot keeps tracking the actual physical name.
  ALTER INDEX IF EXISTS "doc_slug_key"        RENAME TO "page_slug_key";
  ALTER INDEX IF EXISTS "doc_pkey"            RENAME TO "page_pkey";
END $$;
