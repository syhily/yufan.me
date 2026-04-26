import crypto from 'node:crypto'

import config from '@/blog.config'
import { loadBuffer } from '@/server/cache/image'
import { getCatalog } from '@/server/catalog'
import { drawOpenGraph } from '@/server/images/og'
import { pngResponse } from '@/server/route-helpers/http'
import { joinUrl } from '@/shared/urls'

import type { Route } from './+types/image.og'

function ogCacheKey(slug: string, title: string, summary: string, cover: string): string {
  const hash = crypto.createHash('sha1').update(`${title}\u0001${summary}\u0001${cover}`).digest('hex').slice(0, 16)
  return `og-${slug}-${hash}`
}

// Cache for one week — OG images are derived from post metadata that rarely
// changes, and the cache key already incorporates a content hash so a content
// change produces a fresh URL.
const PNG_HEADERS: HeadersInit = {
  'Cache-Control': 'public, max-age=604800, immutable',
}

export function headers() {
  return PNG_HEADERS
}

function fallback() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: joinUrl(config.website, '/images/open-graph.png'),
    },
  })
}

export async function loader({ params }: Route.LoaderArgs) {
  const slug = params.slug
  if (!slug) {
    return fallback()
  }

  const catalog = await getCatalog()
  const post = catalog.getPost(slug)
  if (post) {
    const buffer = await loadBuffer(
      ogCacheKey(slug, post.title, post.summary, post.cover),
      () => drawOpenGraph({ title: post.title, summary: post.summary, cover: post.cover }),
      24 * 60 * 60 * 7,
    )
    return pngResponse(buffer, PNG_HEADERS)
  }

  const page = catalog.getPage(slug)
  if (!page) {
    return fallback()
  }

  const summary = page.summary || config.description
  const buffer = await loadBuffer(
    ogCacheKey(slug, page.title, summary, page.cover),
    () => drawOpenGraph({ title: page.title, summary, cover: page.cover }),
    24 * 60 * 60 * 7,
  )

  return pngResponse(buffer, PNG_HEADERS)
}
