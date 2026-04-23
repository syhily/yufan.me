import type { APIRoute } from 'astro'

import { generateFeeds } from '@/helpers/content/feed'

export type FeedFormat = 'rss' | 'atom'
export type FeedScope = 'site' | 'category' | 'tag'

const CONTENT_TYPE: Record<FeedFormat, string> = {
  rss: 'application/xml; charset=utf-8',
  atom: 'application/atom+xml; charset=utf-8',
}

// Some readers (NetNewsWire, Feedly's prefetcher) issue HEAD before GET.
// We answer with the same headers but no body. The bogus `Server`/`Host`
// values used to live inline in every feed file and were obviously meant as
// part of the wider WordPress honeypot story; we keep them here in one
// place so the joke is centralised.
function feedHeadResponse(format: FeedFormat): Response {
  return new Response('', {
    headers: {
      Host: import.meta.env.SITE,
      'Content-Type': CONTENT_TYPE[format],
      Accept: '*/*',
      Connection: 'keep-alive',
    },
  })
}

interface BuildFeedRouteOptions {
  format: FeedFormat
  scope?: FeedScope
}

export function buildFeedRoute({ format, scope = 'site' }: BuildFeedRouteOptions): {
  GET: APIRoute
  HEAD: APIRoute
} {
  const GET: APIRoute = async ({ params }) => {
    const slug = (params as { slug?: string }).slug
    const filter = scope === 'category' ? { category: slug } : scope === 'tag' ? { tag: slug } : undefined
    const feed = await generateFeeds(filter)
    return new Response(format === 'rss' ? feed.rss : feed.atom, {
      headers: { 'Content-Type': CONTENT_TYPE[format] },
    })
  }
  const HEAD: APIRoute = async () => feedHeadResponse(format)
  return { GET, HEAD }
}
