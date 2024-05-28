import { increaseLikes } from '@/helpers/db/query';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ params }) => {
  const { slug } = params;
  const likes = typeof slug === 'undefined' ? 0 : await increaseLikes(slug);

  return new Response(
    JSON.stringify({
      likes: likes,
    }),
  );
};
