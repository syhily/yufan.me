export async function loader() {
  const { generateFeeds } = await import('@/services/feed/index.server')
  const feed = await generateFeeds()
  return new Response(feed.atom, {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  })
}
