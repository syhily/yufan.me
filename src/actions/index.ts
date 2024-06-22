import Comment from '@/components/comment/Comment.astro';
import CommentItem from '@/components/comment/CommentItem.astro';
import { commentConfig, createComment, loadComments } from '@/components/comment/artalk';
import { partialRender } from '@/helpers/container';
import { decreaseLikes, increaseLikes, queryLikes } from '@/helpers/db/query';
import { pages, posts } from '@/helpers/schema';
import { urlJoin } from '@/helpers/tools';
import { z } from 'astro/zod';
import { ActionError, defineAction } from 'astro:actions';
import crypto from 'node:crypto';

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
      const config = await commentConfig();
      if (config === null) {
        throw CommentConnectError;
      }

      const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
      return { avatar: urlJoin(config.frontend_conf.gravatar.mirror, `${hash}?d=mm&s=80`) };
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
        throw CommentConnectError;
      }

      const config = await commentConfig();
      const content = await partialRender(CommentItem, {
        props: { depth: 2, comment: resp, pending: resp.is_pending, config: config },
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
      const config = await commentConfig();
      if (config === null) {
        throw CommentConnectError;
      }

      const comments = await loadComments(page_key, null, Number(offset), config);
      if (comments === null) {
        throw CommentConnectError;
      }

      const content = await partialRender(Comment, { props: { comments: comments, config: config } });

      return { content };
    },
  }),
};
