import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { getAdminCacheStats } from '@/server/cache/admin-service'
import { routeMeta } from '@/server/seo/meta'
import { CacheView } from '@/ui/admin/settings/CacheView'

import type { Route } from './+types/wp-admin.settings.cache'

export function meta() {
  return routeMeta({ title: '缓存管理' })
}

// Fetched per-navigation so the editor always sees a fresh SCAN result.
// The snapshot is small (one count per bucket) and the read is
// independent of the parent layout's settings snapshot, so we don't
// hoist it into the layout loader. The editable cache slice itself
// (prefixes / TTLs) does come from the parent layout via outlet
// context — see the component below.
export async function loader(_args: Route.LoaderArgs) {
  const stats = await getAdminCacheStats()
  return { stats }
}

export default function WpAdminSettingsCacheRoute({ loaderData }: Route.ComponentProps) {
  const { settings, csrfToken } = useOutletContext<SettingsOutletContext>()
  return <CacheView stats={loaderData.stats} cache={settings.settings.cache} csrfToken={csrfToken} />
}
