import { PinnedCategories } from '@/components/category/pinned';
import { FeaturePosts } from '@/components/post/feature';
import { PostPagination } from '@/components/post/pagination';
import { Sidebar } from '@/components/sidebar/sidebar';
import { Post, Tag } from '#site/content';

export function ListPosts({ posts, tags, pageNum }: { posts: Post[]; tags: Tag[]; pageNum: number }) {
  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      <FeaturePosts posts={posts} />
      <div className="container">
        <div className="row">
          <PostPagination pageNum={pageNum} posts={posts} />
          <Sidebar posts={posts} tags={tags} />
        </div>
        <PinnedCategories />
      </div>
    </div>
  );
}
