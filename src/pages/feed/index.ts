import { generateFeeds } from '@/helpers/content/feed';

export async function GET() {
  const feed = await generateFeeds();
  return new Response(feed.rss, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

// The rss reader may prefetch by using HEAD method.
export async function HEAD() {
  return new Response('', {
    headers: {
      'Host': import.meta.env.SITE,
      'Content-Type': 'application/xml; charset=utf-8',
      'Accept': '*/*',
      'Connection': 'keep-alive',
    },
  })
}
