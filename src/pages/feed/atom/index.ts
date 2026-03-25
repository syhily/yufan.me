import { atom } from '@/pages/feed/source';

export async function GET() {
  return new Response(atom, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
}

// The rss reader may prefetch by using HEAD method.
export async function HEAD() {
  return new Response('', {
    headers: {
      'Host': import.meta.env.SITE,
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Accept': '*/*',
      'Connection': 'keep-alive',
    },
  })
}
