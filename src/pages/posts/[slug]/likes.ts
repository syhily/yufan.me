import { decreaseLikes, increaseLikes, queryLikes } from '@/helpers/db/query';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ params, request }) => {
  const { slug } = params;
  const resp = await request.json();

  // Increase.
  if (resp.action === 'increase') {
    if (typeof slug === 'undefined') {
      return Response.json({ likes: 0, token: '' });
    }

    const { likes, token } = await increaseLikes(slug);
    return Response.json({ likes: likes, token: token });
  }

  // Decrease.
  if (resp.action === 'decrease' && resp.token !== '') {
    if (typeof slug === 'undefined') {
      return Response.json({ likes: 0 });
    }

    await decreaseLikes(slug, resp.token);
    const likes = await queryLikes(slug);
    return Response.json({ likes: likes });
  }

  return Response.json({ likes: 0 });
};
