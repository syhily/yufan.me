import { buildSitemapXml } from '@/server/seo/sitemap'

import type { Route } from './+types/sitemap'

export function headers() {
  return {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const xml = await buildSitemapXml(request)
  return new Response(xml, { headers: headers() })
}
