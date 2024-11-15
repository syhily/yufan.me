import type { Comment, CommentItem, CommentReq, CommentResp, Comments, ErrorResp } from '@/components/comment/types';
import { queryUser } from '@/helpers/db/query';
import { parseContent } from '@/helpers/markdown';
import { urlJoin } from '@/helpers/tools';
import options from '@/options';
import { ARTALK_HOST, ARTALK_PORT, ARTALK_SCHEME } from 'astro:env/server';
import _ from 'lodash';
import querystring from 'node:querystring';

// Access the artalk in internal docker host when it was deployed on zeabur.
const server = `${ARTALK_SCHEME}://${ARTALK_HOST}:${ARTALK_PORT}`;

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

export const createComment = async (
  commentReq: CommentReq,
  req: Request,
  clientAddress: string,
): Promise<ErrorResp | CommentResp> => {
  const user = await queryUser(commentReq.email);
  if (user !== null && user.name !== null) {
    // Replace the comment user name for avoiding the duplicated users creation.
    // We may add the commenter account management in the future.
    commentReq.name = user.name;
  }

  // Query the existing comments for the user.
  const historicalParams = new URLSearchParams({
    email: commentReq.email,
    page_key: commentReq.page_key,
    site_name: options.title,
    flat_mode: 'true',
    limit: '5',
    sort_by: 'date_desc',
    type: 'all',
  }).toString();
  const historicalComments = await fetch(urlJoin(server, `/api/v2/comments?${historicalParams}`), {
    method: 'GET',
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
  })
    .then(async (resp) => (await resp.json()).comments as Comment[])
    .catch((e) => {
      console.error(e);
      return Array<Comment>();
    });

  if (historicalComments.find((comment) => comment.content === commentReq.content)) {
    return { msg: '重复评论，你已经有了相同的留言，如果在页面看不到，说明它正在等待站长审核。' };
  }

  const response = await fetch(urlJoin(server, '/api/v2/comments'), {
    method: 'POST',
    headers: {
      'User-Agent': req.headers.get('User-Agent') || 'node',
      'X-Forwarded-For': clientAddress,
      'Content-type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ ...commentReq, site_name: options.title, rid: commentReq.rid ? Number(commentReq.rid) : 0 }),
  }).catch((e) => {
    console.error(e);
    return null;
  });

  if (response === null) {
    return { msg: '服务端异常，评论创建失败。' };
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
