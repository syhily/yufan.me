import { getConfig, loadComments } from '@/components/comment/artalk';
import Comment from '@/components/comment/Comment.astro';
import { partialRender } from '@/helpers/container';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get('key');
  if (key == null) {
    return new Response('');
  }

  const offset = url.searchParams.get('offset');
  if (offset == null) {
    return new Response('');
  }

  const config = await getConfig();
  if (config === null) {
    return new Response('');
  }

  const comments = await loadComments(key, Number(offset), config);
  if (comments === null) {
    return new Response('');
  }

  const html = await partialRender(Comment, { props: { comments: comments, config: config } });
  return new Response(html);
};
