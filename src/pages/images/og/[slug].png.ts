import type { APIRoute } from 'astro'
import config from '@/blog.config'
import { loadBuffer } from '@/helpers/cache'
import { drawOpenGraph } from '@/helpers/content/og'
import { getPage, getPost } from '@/helpers/content/schema'

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
  const post = getPost(slug)
  if (!post) {
    // Fallback to query from pages
    const page = getPage(slug)
    if (!page) {
      return await fallback()
    }

    title = page.title
    summary = page.summary || config.description
    cover = page.cover
  }
  else {
    title = post.title
    summary = post.summary
    cover = post.cover
  }

  // Fetch the cover image as the background
  const buffer = await loadBuffer(`open-graph-${cover}`, () => drawOpenGraph({ title, summary, cover }), 24 * 60 * 60 * 7)
  return new Response(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'image/png' },
  })
}
