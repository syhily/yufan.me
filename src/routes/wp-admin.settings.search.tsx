import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { SearchForm, type SearchLoaderShape } from '@/ui/admin/settings/SearchForm'

import type { Route } from './+types/wp-admin.settings.search'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '文章搜索' }, bundleFromMatches(matches))
}

export default function WpAdminSettingsSearchRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  const search = bundle.search ?? {
    search: {
      enabled: false,
      mode: 'like',
      endpoint: '',
      apiKey: '',
      model: 'text-embedding-3-small',
      similarityThreshold: 0.5,
    },
  }
  const apiKey = typeof search.search.apiKey === 'string' ? search.search.apiKey : ''
  const projection: SearchLoaderShape = {
    search: {
      enabled: search.search.enabled === true,
      mode: search.search.mode === 'vector' ? 'vector' : 'like',
      endpoint: search.search.endpoint ?? '',
      apiKey,
      model: search.search.model ?? 'text-embedding-3-small',
      similarityThreshold: search.search.similarityThreshold ?? 0.5,
    },
    apiKeyMask: apiKey === '' ? null : apiKey.slice(-4),
  }
  return <SearchForm search={projection} />
}
