import type { APIRoute } from 'astro'

import crypto from 'node:crypto'

import config from '@/blog.config'
import { getPage, getPost } from '@/services/catalog/schema'
import { drawOpenGraph } from '@/services/images/og'
import { loadBuffer } from '@/shared/cache'

// 8 hex chars (32 bits) is plenty for cache busting; collisions only result
// in the wrong cached image which would already be invalidated next time.
function ogCacheKey(slug: string, title: string, summary: string, cover: string): string {
  const hash = crypto.createHash('sha1').update(`${title}\u0001${summary}\u0001${cover}`).digest('hex').slice(0, 16)
  return `og-${slug}-${hash}`
}

async function fallback() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${import.meta.env.SITE}/images/open-graph.png`,
    },
  })
}

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug
  if (!slug) {
    return await fallback()
  }

  let title: string
  let summary: string
  let cover: string

  // Query the post
  const post = await getPost(slug)
  if (!post) {
    // Fallback to query from pages
    const page = await getPage(slug)
    if (!page) {
      return await fallback()
    }

    title = page.title
    summary = page.summary || config.description
    cover = page.cover
  } else {
    title = post.title
    summary = post.summary
    cover = post.cover
  }

  // Cache key incorporates title/summary/cover so post edits invalidate the
  // previously rendered open graph image.
  const buffer = await loadBuffer(
    ogCacheKey(slug, title, summary, cover),
    () => drawOpenGraph({ title, summary, cover }),
    24 * 60 * 60 * 7,
  )
  return new Response(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'image/png' },
  })
}
