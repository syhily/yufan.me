import { rss } from '@/pages/feed/source';

export async function GET() {
  return new Response(rss, {
    headers: { "Content-Type": "application/xml" },
  });
}

// The rss reader may prefetch by using HEAD method.
export async function HEAD() {
  return new Response('', {
    headers: {
      'Host': import.meta.env.SITE,
      'Content-Type': 'application/xml',
      'Accept': '*/*',
      'Connection': 'keep-alive',
    },
  })
}
