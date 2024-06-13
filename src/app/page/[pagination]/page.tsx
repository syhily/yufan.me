import { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';

import { ListPosts } from '@/components/page/post';
import { posts, tags } from '#site/content';

export async function generateMetadata({ params: { pagination } }: PostPaginationProps): Promise<Metadata> {
  return {
    title: `第 ${pagination} 页`,
  };
}

export default function Page({ params: { pagination } }: PostPaginationProps) {
  const pageNum = Number(pagination);
  if (pageNum <= 1) {
    permanentRedirect('/');
  }

  return <ListPosts posts={posts} pageNum={pageNum} tags={tags} />;
}
