import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'
import { getAdminCacheStats } from '@/server/infra/redis/admin-ops'
import { bundleFromMatches, routeMeta } from '@/server/render/seo/meta'
import { requireBlogSettingsSection } from '@/shared/config/blog'
import { CacheView } from '@/ui/admin/settings/CacheView'

import type { Route } from './+types/cache'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '缓存管理' }, bundleFromMatches(matches))
}

// Fetched per-navigation so the editor always sees a fresh SCAN result.
// The snapshot is small (one count per bucket) and the read is
// independent of the parent layout's settings snapshot, so we don't
// hoist it into the layout loader. The editable cache slice itself
// (prefixes / TTLs) is also re-read here — through
// `requireBlogSettingsSection('cache')` so legacy rows missing newer
// buckets (e.g. ``imageMeta`) are transparently filled
// in by `withCacheFallbacks()`. Going through the outlet's raw
// `bundle.cache.cache` would skip that safety net and crash the form
// on a stale-shape DB row before backfill rewrites it.
export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  const stats = await getAdminCacheStats()
  const cache = requireBlogSettingsSection('cache').cache
  return { stats, cache }
}

export default function WpAdminSettingsCacheRoute({ loaderData }: Route.ComponentProps) {
  return <CacheView stats={loaderData.stats} cache={loaderData.cache} />
}
