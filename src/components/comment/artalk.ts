import type { Comment, CommentConfig, CommentItem, Comments } from '@/components/comment/types';
import { options } from '@/helpers/schema';
import { urlJoin } from '@/helpers/tools';
import { getSecret } from 'astro:env/server';
import _ from 'lodash';
import { marked } from 'marked';
import * as querystring from 'node:querystring';
import { transform } from 'ultrahtml';
import sanitize from 'ultrahtml/transformers/sanitize';

// Access the artalk in internal docker host when it was deployed on zeabur.
const server = import.meta.env.PROD ? `http://${getSecret('ARTALK_HOST')}:23366` : options.settings.comments.server;

export const getConfig = async (): Promise<CommentConfig | null> => {
  const data = await fetch(urlJoin(server, '/api/v2/conf'))
    .then((response) => response.json())
    .catch((e) => {
      console.log(e);
      return null;
    });
  return data != null ? (data as CommentConfig) : data;
};

export const loadComments = async (key: string, offset: number, config: CommentConfig): Promise<Comments | null> => {
  const query = querystring.stringify({
    limit: config.frontend_conf.pagination.pageSize,
    offset: offset,
    flat_mode: false,
    page_key: key,
    site_name: options.title,
  });
  const data = await fetch(urlJoin(server, `/api/v2/comments?${query}`))
    .then((response) => response.json())
    .catch((e) => {
      console.log(e);
      return null;
    });

  return data != null ? (data as Comments) : data;
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
  const parsed = await marked.parse(content);
  // Avoid the XSS attack.
  return transform(parsed, [
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
        'ul',
        'ol',
        'li',
      ],
      allowComments: false,
    }),
  ]);
};