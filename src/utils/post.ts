import { notFound } from 'next/navigation';

import { Post } from '#site/content';

export function slicePosts(
  posts: Post[],
  pageNum: number,
  pageSize: number,
): { currentPosts: Post[]; totalPage: number } {
  const totalPage = Math.ceil(posts.length / pageSize);
  if (totalPage < pageNum) {
    // This is an invalid page number.
    return notFound();
  }

  return {
    currentPosts:
      pageNum === totalPage
        ? posts.slice((pageNum - 1) * pageSize)
        : posts.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    totalPage,
  };
}
