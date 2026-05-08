-- Merge `blog.localization` and `blog.images` into:
--   * `blog.general`  (gains `locale`, `timeZone`, `timeFormat`)
--   * `blog.assets`   (new row carrying `asset.host` + `asset.scheme`
--                      from the old localization row, plus the entire
--                      `storage` and `upload` subtrees from the old
--                      images row)
--
-- The schema (column shape) is unchanged; this migration only moves
-- JSONB data between rows. A pre-install deployment with no
-- `blog.general` row is a harmless no-op for every step.

DO $$
DECLARE
  loc_data JSONB;
  loc_updated_at TIMESTAMPTZ;
  loc_updated_by BIGINT;
  img_data JSONB;
  img_updated_at TIMESTAMPTZ;
  img_updated_by BIGINT;
BEGIN
  -- Snapshot the source rows up front so DELETE at the bottom doesn't
  -- race with the SELECTs above.
  SELECT data, updated_at, updated_by
    INTO loc_data, loc_updated_at, loc_updated_by
  FROM "setting"
  WHERE scope = 'blog.localization'
  LIMIT 1;

  SELECT data, updated_at, updated_by
    INTO img_data, img_updated_at, img_updated_by
  FROM "setting"
  WHERE scope = 'blog.images'
  LIMIT 1;

  -- 1) Fold locale / timeZone / timeFormat into blog.general.
  --    Only run when both the source and destination rows exist.
  IF loc_data IS NOT NULL
     AND EXISTS (SELECT 1 FROM "setting" WHERE scope = 'blog.general')
  THEN
    UPDATE "setting"
       SET data = data
                  || jsonb_strip_nulls(jsonb_build_object(
                       'locale',     loc_data -> 'locale',
                       'timeZone',   loc_data -> 'timeZone',
                       'timeFormat', loc_data -> 'timeFormat'
                     ))
     WHERE scope = 'blog.general';
  END IF;

  -- 2) Insert blog.assets when at least one of the source rows had data.
  --    The result merges:
  --      asset   ← localization.asset
  --      storage ← images.storage   (or empty {} when missing)
  --      upload  ← images.upload    (or empty {} when missing)
  --    A pre-install deployment never had a `blog.localization` row, so
  --    skip the insert entirely in that case to keep the install gate's
  --    `siteIdentity || assets` invariant honest.
  IF loc_data IS NOT NULL THEN
    INSERT INTO "setting" (scope, data, updated_at, updated_by)
    VALUES (
      'blog.assets',
      jsonb_build_object(
        'asset',   COALESCE(loc_data -> 'asset', '{}'::jsonb),
        'storage', COALESCE(img_data -> 'storage', '{}'::jsonb),
        'upload',  COALESCE(img_data -> 'upload',  '{}'::jsonb)
      ),
      GREATEST(COALESCE(img_updated_at, loc_updated_at), loc_updated_at),
      COALESCE(img_updated_by, loc_updated_by)
    )
    ON CONFLICT (scope) DO UPDATE
      SET data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at,
          updated_by = EXCLUDED.updated_by;
  END IF;

  -- 3) Drop the now-redundant rows.
  DELETE FROM "setting" WHERE scope IN ('blog.localization', 'blog.images');
END $$;
