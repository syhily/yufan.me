import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { ListCategories, QueryCategory } from '@/components/page/category';
import { posts as allPosts } from '#site/content';

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
