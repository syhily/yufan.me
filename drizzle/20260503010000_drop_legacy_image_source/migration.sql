-- Drop the legacy `image.source` discriminator column.
--
-- An earlier shape of the `image` table carried a NOT NULL `source`
-- column to discriminate between S3-backed rows and externally-hosted
-- rows. The `external` row type was dropped from the application code
-- (every row in `image` now represents an object in the configured S3
-- bucket — see AGENTS.md, "Content" section), but the column remained
-- on databases provisioned before the schema simplification was
-- merged. Inserts now omit the field, which trips the NOT NULL
-- constraint:
--
--   error: null value in column "source" of relation "image"
--          violates not-null constraint
--
-- Use IF EXISTS so the migration is a no-op on fresh installs (whose
-- `image` table was created without the column by
-- `20260502082511_add_image_table`).

ALTER TABLE "image" DROP COLUMN IF EXISTS "source";
