import CommentItem from '@/components/comment/CommentItem.astro';
import { createComment, getConfig } from '@/components/comment/artalk';
import type { CommentReq } from '@/components/comment/types';
import { partialRender } from '@/helpers/container';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json()) as CommentReq;
  const resp = await createComment(body);

  if ('msg' in resp) {
    return new Response(`<li>${resp.msg}</li>`);
  }

  const config = await getConfig();
  const content = await partialRender(CommentItem, {
    props: { depth: 2, comment: resp, pending: resp.is_pending, config: config },
  });

  return new Response(content);
};
