import { createComment } from '@/components/comment/artalk';
import type { CommentReq } from '@/components/comment/types';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json()) as CommentReq;
  const resp = await createComment(body);

  if ('msg' in resp) {
    return Response.json(resp, { status: 500 });
  }

  return Response.json(resp);
};
