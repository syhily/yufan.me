-- Migrate blog.socials: rename network 'twitter' → 'x'
UPDATE "setting"
SET "data" = jsonb_set(
  "data",
  '{socials}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN (s->>'network') = 'twitter' THEN jsonb_set(s, '{network}', '"x"')
          ELSE s
        END
      )
      FROM jsonb_array_elements("data"->'socials') AS s
    ),
    '[]'::jsonb
  )
)
WHERE "scope" = 'blog.socials';

-- Remove standalone twitter field from blog.seo
UPDATE "setting"
SET "data" = "data" - 'twitter'
WHERE "scope" = 'blog.seo';

-- Add empty items array to blog.footer if missing
UPDATE "setting"
SET "data" = jsonb_set("data", '{footer,items}', '[]'::jsonb)
WHERE "scope" = 'blog.footer' AND "data"->'footer'->'items' IS NULL;
