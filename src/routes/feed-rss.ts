export async function loader() {
  const { generateFeeds } = await import('@/services/feed/index.server')
  const feed = await generateFeeds()
  return new Response(feed.rss, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
