-- Merge the standalone `blog.footer` section into `blog.general`.
-- After this migration the `footer` settings section is retired;
-- `initialYear`, `icpNo`, and `moeIcpNo` live on `blog.general`.

-- Step 1: Copy footer fields into the general row.
UPDATE "setting" AS gen
SET "data" = gen."data" ||
  jsonb_build_object(
    'initialYear', COALESCE((foot."data"->'footer'->>'initialYear')::int, EXTRACT(YEAR FROM CURRENT_DATE)::int)
  ) ||
  CASE
    WHEN foot."data"->'footer' ? 'icpNo' AND foot."data"->'footer'->>'icpNo' IS NOT NULL
    THEN jsonb_build_object('icpNo', foot."data"->'footer'->>'icpNo')
    ELSE '{}'::jsonb
  END ||
  CASE
    WHEN foot."data"->'footer' ? 'moeIcpNo' AND foot."data"->'footer'->>'moeIcpNo' IS NOT NULL
    THEN jsonb_build_object('moeIcpNo', foot."data"->'footer'->>'moeIcpNo')
    ELSE '{}'::jsonb
  END
FROM "setting" AS foot
WHERE gen."scope" = 'blog.general'
  AND foot."scope" = 'blog.footer';

-- Step 2: Delete the retired footer row.
DELETE FROM "setting" WHERE "scope" = 'blog.footer';
