import { generateFeeds } from '@/helpers/content/feed'

export async function GET({ params }: { params: { slug: string } }) {
  const feed = await generateFeeds({ category: params.slug })
  return new Response(feed.atom, {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  })
}

// The rss reader may prefetch by using HEAD method.
export async function HEAD() {
  return new Response('', {
    headers: {
      Host: import.meta.env.SITE,
      'Content-Type': 'application/atom+xml; charset=utf-8',
      Accept: '*/*',
      Connection: 'keep-alive',
    },
  })
}
