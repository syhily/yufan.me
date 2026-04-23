export async function loader({ params }: { params: { slug?: string } }) {
  if (!params.slug) {
    throw new Response('Not Found', { status: 404 })
  }

  const { generateFeeds } = await import('@/services/feed/index.server')
  const feed = await generateFeeds({ tag: params.slug })
  return new Response(feed.atom, {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  })
}
