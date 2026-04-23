import config from '@/blog.config'
import { joinUrl } from '@/shared/urls'

async function ogCacheKey(slug: string, title: string, summary: string, cover: string): Promise<string> {
  const crypto = await import('node:crypto')
  const hash = crypto.createHash('sha1').update(`${title}\u0001${summary}\u0001${cover}`).digest('hex').slice(0, 16)
  return `og-${slug}-${hash}`
}

function fallback() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: joinUrl(config.website, '/images/open-graph.png'),
    },
  })
}

export async function loader({ params }: { params: { slug?: string } }) {
  const [{ getPage, getPost }, { drawOpenGraph }, { loadBuffer }] = await Promise.all([
    import('@/services/catalog/schema'),
    import('@/services/images/og'),
    import('@/shared/cache.server'),
  ])
  const slug = params.slug
  if (!slug) {
    return fallback()
  }

  const post = await getPost(slug)
  if (post) {
    const buffer = await loadBuffer(
      await ogCacheKey(slug, post.title, post.summary, post.cover),
      () => drawOpenGraph({ title: post.title, summary: post.summary, cover: post.cover }),
      24 * 60 * 60 * 7,
    )
    return new Response(new Uint8Array(buffer), {
      headers: { 'Content-Type': 'image/png' },
    })
  }

  const page = await getPage(slug)
  if (!page) {
    return fallback()
  }

  const summary = page.summary || config.description
  const buffer = await loadBuffer(
    await ogCacheKey(slug, page.title, summary, page.cover),
    () => drawOpenGraph({ title: page.title, summary, cover: page.cover }),
    24 * 60 * 60 * 7,
  )

  return new Response(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'image/png' },
  })
}
