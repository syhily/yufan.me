import Comment from '@/components/comment/Comment.astro';
import CommentItem from '@/components/comment/CommentItem.astro';
import { createComment, loadComments } from '@/components/comment/artalk';
import { partialRender } from '@/helpers/container';
import { decreaseLikes, increaseLikes, queryLikes, queryUserId } from '@/helpers/db/query';
import { pages, posts } from '@/helpers/schema';
import { encodedEmail, urlJoin } from '@/helpers/tools';
import { z } from 'astro/zod';
import { ActionError, defineAction } from 'astro:actions';

const keys = [...posts.map((post) => post.permalink), ...pages.map((page) => page.permalink)];
const CommentConnectError = new ActionError({
  code: 'INTERNAL_SERVER_ERROR',
  message: "couldn't connect to comment server",
});

export const server = {
  like: defineAction({
    accept: 'json',
    input: z
      .object({
        key: z.custom<string>((val) => keys.includes(val)),
      })
      .and(
        z
          .object({
            action: z.enum(['increase']),
          })
          .or(
            z.object({
              action: z.enum(['decrease']),
              token: z.string().min(1),
            }),
          ),
      ),
    handler: async (input) => {
      // Increase the like counts.
      if (input.action === 'increase') {
        return await increaseLikes(input.key);
      }
      // Decrease the like counts.
      await decreaseLikes(input.key, input.token);
      return { likes: await queryLikes(input.key) };
    },
  }),
  avatar: defineAction({
    accept: 'json',
    input: z.object({ email: z.string().email() }),
    handler: async ({ email }) => {
      const id = await queryUserId(email);
      const hash = id === null ? encodedEmail(email) : `${id}`;
      return { avatar: urlJoin(import.meta.env.SITE, 'avatar', `${hash}.webp`) };
    },
  }),
  comment: defineAction({
    accept: 'json',
    input: z.object({
      page_key: z.string(),
      name: z.string(),
      email: z.string().email(),
      link: z.string().optional(),
      content: z.string().min(1),
      rid: z.number().optional(),
    }),
    handler: async (request) => {
      const resp = await createComment(request);
      if ('msg' in resp) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: resp.msg,
        });
      }

      const content = await partialRender(CommentItem, {
        props: { depth: resp.rid === 0 ? 1 : 2, comment: resp, pending: resp.is_pending },
      });

      return { content };
    },
  }),
  comments: defineAction({
    accept: 'json',
    input: z.object({
      page_key: z.string(),
      offset: z.number(),
    }),
    handler: async ({ page_key, offset }) => {
      const comments = await loadComments(page_key, null, Number(offset));
      if (comments === null) {
        throw CommentConnectError;
      }

      const content = await partialRender(Comment, { props: { comments: comments } });

      return { content };
    },
  }),
};
