import crypto from 'node:crypto'

import { loadBuffer } from '@/server/cache/image'
import { findPostBySlug, findPageBySlug } from '@/server/catalog'
import { drawOpenGraph } from '@/server/images/og'
import { pngResponse } from '@/server/route-helpers/http'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { joinUrl } from '@/shared/urls'

import type { Route } from './+types/image.og'

function ogCacheKey(slug: string, title: string, summary: string, cover: string): string {
  const hash = crypto.createHash('sha1').update(`${title}\u0001${summary}\u0001${cover}`).digest('hex').slice(0, 16)
  // Read the prefix from the live snapshot so an admin rename in
  // `/wp-admin/settings/cache` takes effect on the next request. Old
  // keys under the previous prefix age out at their stored TTL.
  return `${requireBlogSettingsSection('cache').cache.og.prefix}${slug}-${hash}`
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
      Location: joinUrl(requireBlogSettingsSection('siteIdentity').website, '/images/open-graph.png'),
    },
  })
}

export async function loader({ params }: Route.LoaderArgs) {
  const slug = params.slug
  if (!slug) {
    return fallback()
  }

  // TTL is also pulled from the live snapshot — `loadBuffer` accepts
  // any positive integer; the schema bounds it to 1h–30d.
  const ttl = requireBlogSettingsSection('cache').cache.og.ttlSeconds

  const post = await findPostBySlug(slug)
  if (post) {
    const buffer = await loadBuffer(
      ogCacheKey(slug, post.title, post.summary, post.cover),
      () => drawOpenGraph({ title: post.title, summary: post.summary, cover: post.cover }),
      ttl,
    )
    return pngResponse(buffer, PNG_HEADERS)
  }

  const page = await findPageBySlug(slug)
  if (!page) {
    return fallback()
  }

  const summary = page.summary || requireBlogSettingsSection('siteIdentity').description
  const buffer = await loadBuffer(
    ogCacheKey(slug, page.title, summary, page.cover),
    () => drawOpenGraph({ title: page.title, summary, cover: page.cover }),
    ttl,
  )

  return pngResponse(buffer, PNG_HEADERS)
}
