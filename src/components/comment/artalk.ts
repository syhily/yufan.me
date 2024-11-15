import type { Comment, CommentItem, CommentReq, CommentResp, Comments, ErrorResp } from '@/components/comment/types';
import { queryUser } from '@/helpers/db/query';
import { urlJoin } from '@/helpers/tools';
import options from '@/options';
import { ARTALK_HOST } from 'astro:env/server';
import _ from 'lodash';
import { marked } from 'marked';
import querystring from 'node:querystring';
import { ELEMENT_NODE, transform, walk } from 'ultrahtml';
import sanitize from 'ultrahtml/transformers/sanitize';

// Access the artalk in internal docker host when it was deployed on zeabur.
const server = options.isProd() ? `http://${ARTALK_HOST}:23366` : options.settings.comments.server;

export const loadComments = async (key: string, title: string | null, offset: number): Promise<Comments | null> => {
  let params: Record<string, string | number | boolean> = {
    limit: options.settings.comments.size,
    offset: offset,
    flat_mode: false,
    page_key: key,
    site_name: options.title,
  };
  if (title !== null) {
    params = { ...params, title: title };
  }
  const data = await fetch(urlJoin(server, `/api/v2/comments?${querystring.stringify(params)}`))
    .then((response) => response.json())
    .catch((e) => {
      console.error(e);
      return null;
    });

  return data !== null ? (data as Comments) : null;
};

export const increaseViews = async (key: string, title: string) => {
  await fetch(urlJoin(server, '/api/v2/pages/pv'), {
    method: 'POST',
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      page_key: key,
      page_title: title,
      site_name: options.title,
    }),
  });
};

export const createComment = async (req: CommentReq): Promise<ErrorResp | CommentResp> => {
  const user = await queryUser(req.email);
  if (user !== null && user.name !== null) {
    // Replace the comment user name for avoiding the duplicated users creation.
    // We may add the commenter account management in the future.
    req.name = user.name;
  }

  const response = await fetch(urlJoin(server, '/api/v2/comments'), {
    method: 'POST',
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ ...req, site_name: options.title, rid: req.rid ? Number(req.rid) : 0 }),
  }).catch((e) => {
    console.error(e);
    return null;
  });

  if (response === null) {
    return { msg: 'failed to create comment' };
  }

  if (!response.ok) {
    return (await response.json()) as ErrorResp;
  }

  // Parse comment content.
  const commentResp = (await response.json()) as CommentResp;
  commentResp.content = await parseContent(commentResp.content);

  return commentResp;
};

export const parseComments = async (comments: Comment[]): Promise<CommentItem[]> => {
  const parsedComments = await Promise.all(
    comments.map(async (comment) => ({ ...comment, content: await parseContent(comment.content) })),
  );
  const childComments = _.groupBy(
    parsedComments.filter((comment) => !rootCommentFilter(comment)),
    (c) => c.rid,
  );

  return parsedComments.filter(rootCommentFilter).map((comment) => commentItems(comment, childComments));
};

const rootCommentFilter = (comment: Comment): boolean =>
  comment.rid === 0 || comment.rid === null || typeof comment.rid === 'undefined';

const commentItems = (comment: Comment, childComments: _.Dictionary<Comment[]>): CommentItem => {
  const children = childComments[`${comment.id}`];
  if (typeof children === 'undefined') {
    return comment;
  }

  return { ...comment, children: children.map((child) => commentItems(child, childComments)) };
};

const parseContent = async (content: string): Promise<string> => {
  // Support paragraph in blank line.
  const escapedContent = content.replace(/\r\n/g, '\n').replace(/(?<!\n)\n(?!\n)/g, '<br />');
  const parsed = await marked.parse(escapedContent);
  // Avoid the XSS attack.
  return transform(parsed, [
    async (node) => {
      await walk(node, (node) => {
        if (node.type === ELEMENT_NODE) {
          if (node.name === 'a' && !node.attributes.href?.startsWith('https://yufan.me')) {
            node.attributes.target = '_blank';
            node.attributes.rel = 'nofollow';
          }
        }
      });

      return node;
    },
    sanitize({
      allowElements: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'a',
        'img',
        'span',
        'strong',
        'code',
        'pre',
        'blockquote',
        'del',
        'i',
        'u',
        'sup',
        'sub',
        'em',
        'b',
        'font',
        'hr',
        'br',
        'ul',
        'ol',
        'li',
      ],
      allowAttributes: {
        src: ['img'],
        width: ['img'],
        height: ['img'],
        rel: ['a'],
        target: ['a'],
      },
      allowComments: false,
    }),
  ]);
};
