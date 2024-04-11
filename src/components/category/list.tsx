import { Navigation } from '@/components/navigation/navigation';
import { PostSquare } from '@/components/post/pagination';
import { slicePosts } from '@/utils/list';
import { Category, options, Post } from '#site/content';

export function ListCategories({ category, posts, pageNum }: { category: Category; posts: Post[]; pageNum: number }) {
  const { currentPosts, totalPage } = slicePosts(posts, pageNum, options.settings.pagination.category);
  const postCards = currentPosts.map((post, index) => <PostSquare key={post.slug} post={post} first={index === 0} />);

  return (
    <div className="container">
      <div className="mb-3 mb-lg-4">
        <h1>{category.name}</h1>
        <div className="text-muted mt-1">{category.description}</div>
      </div>
      <div className="row g-2 g-md-3 g-xxl-4 list-grouped">{postCards}</div>
      <div className="mt-4 mt-lg-5">
        <Navigation current={pageNum} total={totalPage} rootPath={category.permalink} />
      </div>
    </div>
  );
}
