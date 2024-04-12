import { Pagination } from '@/components/navigation/pagination';
import { PostSquare } from '@/components/page/post';
import { slicePosts } from '@/utils/list';
import { options, Post, Tag, tags } from '#site/content';

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
        <Pagination current={pageNum} total={totalPage} rootPath={tag.permalink} />
      </div>
    </div>
  );
}

export function QueryTag({ name, slug }: { name?: string; slug?: string }): Tag | undefined {
  return tags.find((tag) => tag.name === name || tag.slug === slug);
}
