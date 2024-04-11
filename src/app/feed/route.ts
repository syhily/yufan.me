// The max allowed counts in rss.
import { Feed } from 'feed';
import { cache } from 'react';

import { options, Post, posts as allPosts } from '#site/content';

export async function GET() {
  let latestPosts: Post[];
  if (options.settings.post.sort === 'asc') {
    latestPosts = allPosts
      .sort((left: any, right: any) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, options.settings.feed.size);
  } else {
    latestPosts = allPosts.slice(0, options.settings.feed.size);
  }

  const feed = generateRssFeed(latestPosts, options.settings.feed.full);

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 's-maxage=86400, stale-while-revalidate=3600',
      'CDN-Cache-Control': 'max-age=86400',
      'Vercel-CDN-Cache-Control': 'max-age=86400',
    },
  });
}

const generateRssFeed = cache((posts: Post[], full: boolean) => {
  const feed = new Feed({
    title: options.title,
    description: options.description,
    id: options.website,
    link: options.website,
    feedLinks: {
      rss2: `${options.website}/feed`,
    },
    author: {
      name: options.author.name,
    },
    copyright: 'CC BY-NC-SA 4.0',
  });

  posts.forEach((post) => {
    feed.addItem({
      title: post.title,
      id: post.slug,
      link: post.permalink,
      description: post.summary ?? post.excerpt,
      content: full ? post.raw : '',
      date: new Date(post.date),
    });
  });

  return feed.rss2();
});
