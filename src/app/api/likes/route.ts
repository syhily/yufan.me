import { NextRequest, NextResponse } from 'next/server';

import { increaseLikes, queryLikes } from '@/components/database/query';
import { posts } from '#site/content';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const permalink = searchParams.get('permalink');
  const post = posts.find((post) => post.permalink === permalink);
  if (post) {
    const likes = await queryLikes(post.permalink);
    return NextResponse.json({ likes });
  }

  return NextResponse.json({ likes: 0 });
}

export async function POST(req: NextRequest) {
  const { permalink } = await req.json();
  const post = posts.find((post) => post.permalink === permalink);
  if (post) {
    const likes = await increaseLikes(post.permalink);
    return NextResponse.json({ likes: likes });
  }

  return NextResponse.json({ likes: 0 });
}
