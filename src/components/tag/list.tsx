import { Navigation } from '@/components/navigation/navigation';
import { PostSquare } from '@/components/post/pagination';
import { slicePosts } from '@/utils/list';
import { options, Post, Tag } from '#site/content';

export function ListTags({ tag, posts, pageNum }: { tag: Tag; posts: Post[]; pageNum: number }) {
  const { currentPosts, totalPage } = slicePosts(posts, pageNum, options.settings.pagination.tags);
  const postCards = currentPosts.map((post, index) => <PostSquare key={post.slug} post={post} first={index === 0} />);

  return (
    <div className="container">
      <div className="mb-3 mb-lg-4">
        <h1>{tag.name}</h1>
      </div>
      <div className="row g-2 g-md-3 g-xxl-4 list-grouped">{postCards}</div>
      <div className="mt-4 mt-lg-5">
        <Navigation current={pageNum} total={totalPage} rootPath={tag.permalink} />
      </div>
    </div>
  );
}
