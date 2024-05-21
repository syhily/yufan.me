import type { Post } from '@/content/schema';

export function slicePosts(
  posts: Post[],
  pageNum: number,
  pageSize: number,
): { currentPosts: Post[]; totalPage: number } | null {
  const totalPage = Math.ceil(posts.length / pageSize);
  if (totalPage < pageNum) {
    // This is an invalid page number.
    return null;
  }

  return {
    currentPosts:
      pageNum === totalPage
        ? posts.slice((pageNum - 1) * pageSize)
        : posts.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    totalPage,
  };
}
