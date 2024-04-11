import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ListTags, QueryTag } from '@/components/page/tag';
import { posts as allPosts, tags } from '#site/content';

export function generateStaticParams() {
  return tags.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params: { slug } }: SlugProps): Promise<Metadata> {
  const tag = QueryTag({ slug: slug });
  if (!tag) {
    return notFound();
  }

  return {
    title: `标签 “${tag.name}”`,
  };
}

export default function TagComponent({ params: { slug } }: SlugProps) {
  const tag = QueryTag({ slug: slug });
  if (!tag) {
    return notFound();
  }

  const posts = allPosts.filter((post) => post.tags != null && post.tags.includes(tag.name));
  if (posts.length === 0) {
    return notFound();
  }

  return <ListTags tag={tag} posts={posts} pageNum={1} />;
}
