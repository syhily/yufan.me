import type { APIRoute } from 'astro'
import { defaultOpenGraph, drawOpenGraph } from '@/helpers/og'
import { getPage, getPost, pages, posts } from '@/helpers/schema'
import options from '@/options'

async function fallback() {
  return new Response(await defaultOpenGraph(), {
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
  const buffer = await drawOpenGraph({ title, summary, cover })

  return new Response(buffer, {
    headers: { 'Content-Type': 'image/png' },
  })
}

export async function getStaticPaths() {
  return [
    ...posts.filter(post => !post.og).map(post => ({ params: { slug: post.slug } })),
    ...pages.filter(page => !page.og).map(page => ({ params: { slug: page.slug } })),
  ]
}
