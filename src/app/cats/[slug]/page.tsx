import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ListCategories, QueryCategory } from '@/components/page/category';
import { posts as allPosts } from '#site/content';

export async function generateMetadata({ params: { slug } }: SlugProps): Promise<Metadata> {
  const meta = QueryCategory({ slug: slug });
  if (!meta) {
    notFound();
  }

  return {
    title: `${meta.name}`,
  };
}

export default function CategoryComponent({ params: { slug } }: SlugProps) {
  const meta = QueryCategory({ slug: slug });
  if (!meta) {
    notFound();
  }

  const posts = allPosts.filter((post) => post.category === meta.name);
  if (posts.length === 0) {
    notFound();
  }

  return <ListCategories category={meta} posts={posts} pageNum={1} />;
}
