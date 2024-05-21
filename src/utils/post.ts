import type { Post } from '@/content/schema';

export function slicePosts(
  posts: Post[],
  pageNum: number,
  pageSize: number,
): { currentPosts: Post[]; totalPage: number } | undefined {
  const totalPage = Math.ceil(posts.length / pageSize);
  if (totalPage >= pageNum) {
    return {
      currentPosts:
        pageNum === totalPage
          ? posts.slice((pageNum - 1) * pageSize)
          : posts.slice((pageNum - 1) * pageSize, pageNum * pageSize),
      totalPage,
    };
  }
}
