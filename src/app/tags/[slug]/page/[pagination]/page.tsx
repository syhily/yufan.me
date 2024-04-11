import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { ListTags } from '@/components/tag/list';
import { QueryTag } from '@/components/tag/query';
import { options, posts as allPosts, tags } from '#site/content';

export function generateStaticParams() {
  return tags.flatMap(({ slug }) => {
    const tag = QueryTag({ slug: slug });
    if (!tag) {
      return [];
    }

    const pageSize = Math.ceil(tag.count / options.settings.pagination.tags);
    const params = [];
    for (let i = 0; i < pageSize; i++) {
      params.push({ slug: slug, pagination: i + 1 });
    }
  });
}

export async function generateMetadata({ params: { slug, pagination } }: SlugPaginationProps): Promise<Metadata> {
  const tag = QueryTag({ slug: slug });
  if (!tag) {
    notFound();
  }

  return {
    title: `标签 “${tag.name}” - 第 ${pagination} 页`,
  };
}

export default function TagPageComponent({ params: { slug, pagination } }: SlugPaginationProps) {
  const tag = QueryTag({ slug: slug });
  if (!tag) {
    return notFound();
  }

  const pageNum = Number(pagination);
  if (pageNum <= 1) {
    return permanentRedirect(tag.permalink);
  }

  const posts = allPosts.filter((post) => post.tags != null && post.tags.includes(tag.name));
  if (posts.length === 0) {
    return notFound();
  }

  return <ListTags tag={tag} posts={posts} pageNum={pageNum} />;
}
