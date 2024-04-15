import Fuse from 'fuse.js';
import { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { redirect } from 'next/navigation';
import React from 'react';

import { PostSquare } from '@/components/page/post';
import { options, Post, posts as allPosts } from '#site/content';

const searchIndex = unstable_cache(async () => {
  const indexes = Fuse.createIndex<Post>(['title', 'raw', 'tags'], allPosts);
  return new Fuse<Post>(allPosts, { includeScore: true, keys: ['title', 'raw', 'tags'] }, indexes);
}, ['search-index']);

const getHitPosts = unstable_cache(
  async (query) => {
    const fuse = await searchIndex();
    return fuse.search<Post>(query);
  },
  ['search-posts'],
);

export async function generateMetadata({ searchParams }: SearchProps): Promise<Metadata> {
  const query = searchParams ? searchParams['q'] : null;
  if (!query) {
    redirect('/');
  }

  return {
    title: `${query} 查询结果`,
  };
}

export default async function SearchComponent({ searchParams }: SearchProps) {
  const query = searchParams ? (searchParams['q'] as string) : null;
  if (!query) {
    redirect('/');
  }

  const search = await getHitPosts(query);
  const results = search.map((s) => s.item).slice(0, options.settings.pagination.search);

  console.log(query);
  console.log(results);
  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      <ListQuery title={`“${query}” 查询结果`} posts={results} />
    </div>
  );
}

function ListQuery({ title, posts }: Readonly<{ title: string; posts: Post[] }>) {
  const postCards = posts.map((post, index) => <PostSquare key={post.slug} post={post} first={index === 0} />);
  return (
    <div className="container">
      <div className="mb-3 mb-lg-4">
        <h1>{title}</h1>
      </div>
      <div className="row g-2 g-md-3 g-xxl-4 list-grouped">{postCards}</div>
    </div>
  );
}
