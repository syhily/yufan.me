import Image from 'next/image';
import Link from 'next/link';

import { Pagination } from '@/components/navigation/pagination';
import { PostSquare } from '@/components/page/post';
import { slicePosts } from '@/utils/list';
import { categories, Category, options, Post } from '#site/content';

export function QueryCategory({ name, slug }: { name?: string; slug?: string }): Category | undefined {
  return categories.find((c) => c.name === name || c.slug === slug);
}

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
        <Pagination current={pageNum} total={totalPage} rootPath={category.permalink} />
      </div>
    </div>
  );
}

export function PinnedCategories() {
  const pinnedSlug = options.settings.post.category ?? [];
  if (pinnedSlug.length === 0) {
    return <></>;
  }

  const pinnedCategories = pinnedSlug
    .map((slug) => QueryCategory({ slug: slug }))
    .flatMap((category) => (category !== undefined ? [category] : []))
    .map((category) => <PinnedCategory key={category.slug} category={category} />);

  return <div className="row g-2 g-md-4 list-grouped mt-3 mt-md-4">{pinnedCategories}</div>;
}

function PinnedCategory({ category }: { category: Category }) {
  return (
    <div className="col-md-6">
      <div className="list-item block ">
        <div className="media media-3x1">
          <Link href={category.permalink} className="media-content ">
            <Image
              src={category.cover.src}
              width={category.cover.width}
              height={category.cover.height}
              placeholder="blur"
              blurDataURL={category.cover.blurDataURL}
              alt={category.name}
            />
          </Link>
        </div>
        <div className="list-content">
          <div className="list-body">
            <Link href={category.permalink} className="list-title h5">
              {category.name}
            </Link>
            <div className="list-subtitle d-none d-md-block text-md text-secondary mt-2">
              <div className="h-1x">{category.description}</div>
            </div>
          </div>
          <div className="list-footer mt-2">
            <div className="text-muted text-sm">
              <span className="d-inline-block">{`${category.count} 篇文章`}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
