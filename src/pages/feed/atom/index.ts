import { FEED } from '@/pages/feed/source';

export async function GET() {
  return new Response(FEED.atom1(), {
    headers: { "Content-Type": "application/atom+xml" },
  });
}

// The rss reader may prefetch by using HEAD method.
export async function HEAD() {
  return new Response('', {
    headers: {
      'Host': import.meta.env.SITE,
      'Content-Type': 'application/atom+xml',
      'Accept': '*/*',
      'Connection': 'keep-alive',
    },
  })
}
