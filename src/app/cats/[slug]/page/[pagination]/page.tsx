import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { ListCategories } from '@/components/category/list';
import { QueryCategory } from '@/components/category/query';
import { categories, options, posts as allPosts } from '#site/content';

export function generateStaticParams() {
  return categories.flatMap(({ slug }) => {
    const cat = QueryCategory({ slug: slug });
    if (!cat) {
      return [];
    }

    const pageSize = Math.ceil(cat.count / options.settings.pagination.category);
    const params = [];
    for (let i = 0; i < pageSize; i++) {
      params.push({ slug: slug, pagination: i + 1 });
    }
  });
}

export async function generateMetadata({ params: { slug, pagination } }: SlugPaginationProps): Promise<Metadata> {
  const cat = QueryCategory({ slug: slug });
  if (!cat) {
    notFound();
  }

  return {
    title: `${cat.name} - 第 ${pagination} 页`,
  };
}

export default function CategoryPageComponent({ params: { slug, pagination } }: SlugPaginationProps) {
  const cat = QueryCategory({ slug: slug });
  if (!cat) {
    notFound();
  }

  const pageNum = Number(pagination);
  if (pageNum <= 1) {
    permanentRedirect(cat.permalink);
  }

  const posts = allPosts.filter((post) => post.category === cat.name);
  if (posts.length === 0) {
    notFound();
  }

  return <ListCategories category={cat} posts={posts} pageNum={pageNum} />;
}
