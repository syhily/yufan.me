-- Migrate footer navigation items into the navigation section.
-- The navigation section is renamed from a flat array to a nested object:
--   { navigation: NavigationItem[] }
--   → { navigation: { sideNav: NavigationItem[], footerNav: FooterNavItem[] } }
--
-- The footer section loses its `items` field:
--   { footer: { initialYear, icpNo?, moeIcpNo?, items } }
--   → { footer: { initialYear, icpNo?, moeIcpNo? } }

-- Step 1: When a footer row exists, migrate its items into navigation.footerNav
-- and wrap the existing navigation array into sideNav.
UPDATE "setting" AS nav
SET "data" = jsonb_build_object(
  'navigation', jsonb_build_object(
    'sideNav', COALESCE(nav."data"->'navigation', '[]'::jsonb),
    'footerNav', COALESCE(foot."data"->'footer'->'items', '[]'::jsonb)
  )
)
FROM "setting" AS foot
WHERE nav."scope" = 'blog.navigation'
  AND foot."scope" = 'blog.footer'
  AND jsonb_typeof(nav."data"->'navigation') = 'array';

-- Step 2: When no footer row exists, just wrap the navigation array.
UPDATE "setting"
SET "data" = jsonb_build_object(
  'navigation', jsonb_build_object(
    'sideNav', COALESCE("data"->'navigation', '[]'::jsonb),
    'footerNav', '[]'::jsonb
  )
)
WHERE "scope" = 'blog.navigation'
  AND jsonb_typeof("data"->'navigation') = 'array';

-- Step 3: Remove items from blog.footer.
UPDATE "setting"
SET "data" = jsonb_build_object('footer', ("data"->'footer') - 'items')
WHERE "scope" = 'blog.footer'
  AND "data"->'footer' ? 'items';
