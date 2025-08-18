import type { APIRoute } from 'astro'
import { gunzipSync } from 'node:zlib'
import { cacheBuffer, loadBuffer } from '@/helpers/cache'
import { drawOpenGraph } from '@/helpers/content/og'
import { getPage, getPost } from '@/helpers/content/schema'
import defaultOpenGraph from '@/images/open-graph.png?binary'
import options from '@/options'

const fallbackOpenGraph = gunzipSync(defaultOpenGraph)

async function fallback() {
  return new Response(new Uint8Array(fallbackOpenGraph), {
    headers: { 'Content-Type': 'image/png' },
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
  const post = getPost(slug)
  if (!post) {
    // Fallback to query from pages
    const page = getPage(slug)
    if (!page) {
      return await fallback()
    }

    title = page.title
    summary = page.summary || options.description
    cover = page.cover.src
  }
  else {
    title = post.title
    summary = post.summary
    cover = post.cover.src
  }

  // Fetch the cover image as the background
  let buffer = await loadBuffer(`open-graph-${cover}`)
  if (buffer === null) {
    buffer = await drawOpenGraph({ title, summary, cover })
    cacheBuffer(`open-graph-${cover}`, buffer, 24 * 60 * 60)
  }

  return new Response(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'image/png' },
  })
}
