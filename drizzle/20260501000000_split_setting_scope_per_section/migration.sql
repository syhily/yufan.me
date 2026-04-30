-- Split the singleton `setting` row scope='blog' into one row per
-- section so that admin updates only touch their own slice and don't
-- race with concurrent writes to other sections. The column shape is
-- unchanged; this migration only re-buckets existing data.
--
-- Bucket layout (mirrors `SECTION_REGISTRY` in
-- `src/server/settings/sections.ts`):
--   blog.general      → title / description / website / keywords / author
--   blog.localization → settings.{asset, locale, timeZone, timeFormat}
--   blog.navigation   → navigation
--   blog.socials      → socials
--   blog.content      → settings.{pagination, feed, post}
--   blog.sidebar      → settings.sidebar
--   blog.comments     → settings.comments
--   blog.seo          → settings.{twitter, toc, og}
--   blog.footer       → settings.footer
--   blog.mail         → settings.mail
--   blog.cache        → settings.cache
--
-- A pre-install deployment has no `blog` row to copy from; the inserts
-- below are predicated on `EXISTS` so re-running this migration on a
-- fresh database is a harmless no-op.

DO $$
DECLARE
  src JSONB;
  src_inner JSONB;
  src_updated_at TIMESTAMPTZ;
  src_updated_by BIGINT;
BEGIN
  SELECT data, updated_at, updated_by
    INTO src, src_updated_at, src_updated_by
  FROM "setting"
  WHERE scope = 'blog'
  LIMIT 1;

  IF src IS NULL THEN
    RETURN;
  END IF;

  src_inner := COALESCE(src -> 'settings', '{}'::jsonb);

  -- general
  IF src ? 'title' OR src ? 'description' OR src ? 'website' OR src ? 'keywords' OR src ? 'author' THEN
    INSERT INTO "setting" (scope, data, updated_at, updated_by)
    VALUES (
      'blog.general',
      jsonb_strip_nulls(jsonb_build_object(
        'title', src -> 'title',
        'description', src -> 'description',
        'website', src -> 'website',
        'keywords', src -> 'keywords',
        'author', src -> 'author'
      )),
      src_updated_at,
      src_updated_by
    )
    ON CONFLICT (scope) DO NOTHING;
  END IF;

  -- localization
  IF src_inner ? 'asset' OR src_inner ? 'locale' OR src_inner ? 'timeZone' OR src_inner ? 'timeFormat' THEN
    INSERT INTO "setting" (scope, data, updated_at, updated_by)
    VALUES (
      'blog.localization',
      jsonb_strip_nulls(jsonb_build_object(
        'asset', src_inner -> 'asset',
        'locale', src_inner -> 'locale',
        'timeZone', src_inner -> 'timeZone',
        'timeFormat', src_inner -> 'timeFormat'
      )),
      src_updated_at,
      src_updated_by
    )
    ON CONFLICT (scope) DO NOTHING;
  END IF;

  -- navigation
  IF src ? 'navigation' THEN
    INSERT INTO "setting" (scope, data, updated_at, updated_by)
    VALUES (
      'blog.navigation',
      jsonb_build_object('navigation', src -> 'navigation'),
      src_updated_at,
      src_updated_by
    )
    ON CONFLICT (scope) DO NOTHING;
  END IF;

  -- socials
  IF src ? 'socials' THEN
    INSERT INTO "setting" (scope, data, updated_at, updated_by)
    VALUES (
      'blog.socials',
      jsonb_build_object('socials', src -> 'socials'),
      src_updated_at,
      src_updated_by
    )
    ON CONFLICT (scope) DO NOTHING;
  END IF;

  -- content
  IF src_inner ? 'pagination' OR src_inner ? 'feed' OR src_inner ? 'post' THEN
    INSERT INTO "setting" (scope, data, updated_at, updated_by)
    VALUES (
      'blog.content',
      jsonb_strip_nulls(jsonb_build_object(
        'pagination', src_inner -> 'pagination',
        'feed', src_inner -> 'feed',
        'post', src_inner -> 'post'
      )),
      src_updated_at,
      src_updated_by
    )
    ON CONFLICT (scope) DO NOTHING;
  END IF;

  -- sidebar
  IF src_inner ? 'sidebar' THEN
    INSERT INTO "setting" (scope, data, updated_at, updated_by)
    VALUES (
      'blog.sidebar',
      jsonb_build_object('sidebar', src_inner -> 'sidebar'),
      src_updated_at,
      src_updated_by
    )
    ON CONFLICT (scope) DO NOTHING;
  END IF;

  -- comments
  IF src_inner ? 'comments' THEN
    INSERT INTO "setting" (scope, data, updated_at, updated_by)
    VALUES (
      'blog.comments',
      jsonb_build_object('comments', src_inner -> 'comments'),
      src_updated_at,
      src_updated_by
    )
    ON CONFLICT (scope) DO NOTHING;
  END IF;

  -- seo
  IF src_inner ? 'twitter' OR src_inner ? 'toc' OR src_inner ? 'og' THEN
    INSERT INTO "setting" (scope, data, updated_at, updated_by)
    VALUES (
      'blog.seo',
      jsonb_strip_nulls(jsonb_build_object(
        'twitter', src_inner -> 'twitter',
        'toc', src_inner -> 'toc',
        'og', src_inner -> 'og'
      )),
      src_updated_at,
      src_updated_by
    )
    ON CONFLICT (scope) DO NOTHING;
  END IF;

  -- footer
  IF src_inner ? 'footer' THEN
    INSERT INTO "setting" (scope, data, updated_at, updated_by)
    VALUES (
      'blog.footer',
      jsonb_build_object('footer', src_inner -> 'footer'),
      src_updated_at,
      src_updated_by
    )
    ON CONFLICT (scope) DO NOTHING;
  END IF;

  -- mail
  IF src_inner ? 'mail' THEN
    INSERT INTO "setting" (scope, data, updated_at, updated_by)
    VALUES (
      'blog.mail',
      jsonb_build_object('mail', src_inner -> 'mail'),
      src_updated_at,
      src_updated_by
    )
    ON CONFLICT (scope) DO NOTHING;
  END IF;

  -- cache
  IF src_inner ? 'cache' THEN
    INSERT INTO "setting" (scope, data, updated_at, updated_by)
    VALUES (
      'blog.cache',
      jsonb_build_object('cache', src_inner -> 'cache'),
      src_updated_at,
      src_updated_by
    )
    ON CONFLICT (scope) DO NOTHING;
  END IF;

  DELETE FROM "setting" WHERE scope = 'blog';
END $$;
