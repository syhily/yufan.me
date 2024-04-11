import Fuse from 'fuse.js';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import React from 'react';

import { PostSquare } from '@/components/post/pagination';
import { options, Post, posts as allPosts } from '#site/content';

const indexes = Fuse.createIndex(['title', 'raw'], allPosts);
const fuse = new Fuse(allPosts, { keys: ['title', 'raw'] }, indexes);

export async function generateMetadata({ searchParams }: SearchProps): Promise<Metadata> {
  const query = searchParams ? searchParams['q'] : null;
  if (!query) {
    redirect('/');
  }

  return {
    title: `${query} 查询结果`,
  };
}

export default function SearchComponent({ searchParams }: SearchProps) {
  const query = searchParams ? (searchParams['q'] as string) : null;
  if (!query) {
    redirect('/');
  }

  const search = fuse.search<Post>({
    $or: [{ author: query }, { title: query }],
  });
  const results = search.map((s) => s.item).slice(0, options.settings.pagination.search);

  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      <ListQuery title={`“${query}” 查询结果`} posts={results} />
    </div>
  );
}

function ListQuery({ title, posts }: { title: string; posts: Post[] }) {
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
