import { join } from 'node:path';

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import React from 'react';

import { ArtalkComment } from '@/components/comment/artalk';
import { MDXContent } from '@/components/mdx/content';
import { LikeButton } from '@/components/page/like';
import { Share } from '@/components/page/share';
import { Sidebar } from '@/components/sidebar/sidebar';
import { formatShowDate } from '@/utils/formatter';
import { options, Post, posts, tags } from '#site/content';

function getPost(slug: string): Post {
  const post = posts.find((p) => p.slug === slug);
  if (!post) {
    notFound();
  }

  return post;
}

export function generateStaticParams() {
  return posts.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params: { slug } }: SlugProps): Promise<Metadata> {
  const post = getPost(slug);
  const cover = post.cover.src.startsWith('http') ? post.cover.src : join(options.website, post.cover.src);

  return {
    title: post.title,
    metadataBase: new URL(options.website),
    openGraph: {
      title: post.title,
      description: post.summary ?? post.excerpt,
      type: 'article',
      publishedTime: post.date,
      url: post.permalink,
      images: [
        {
          url: cover,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.summary ?? post.excerpt,
      images: [cover],
    },
  };
}

export default function PostComponent({ params: { slug } }: Readonly<SlugProps>) {
  let post = getPost(slug);

  return (
    <>
      <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
        <div className="container">
          <div className="row">
            <div className="content-wrapper col-12 col-xl-9">
              <div className="post card card-md">
                <div className="card-body">
                  <h1 className="post-title">{post.title}</h1>
                  <div className="post-meta text-sm text-muted mt-3 mb-4">
                    <time>{formatShowDate(post.date)}</time>
                  </div>
                  <div className="post-content">
                    <div className="nc-light-gallery">
                      <MDXContent code={post.content} />
                    </div>
                    <nav className="post-in-navigation navigation pagination font-number" role="navigation">
                      <div className="nav-links"></div>
                    </nav>
                  </div>
                  <LikeButton />
                  <Share post={post} />
                  {/* We are about to migrate the post's slug to new URL */}
                  <ArtalkComment id={post.slug} title={post.title} hidden={post.comments} />
                </div>
              </div>
            </div>
            <Sidebar posts={posts} tags={tags} />
          </div>
        </div>
      </div>
    </>
  );
}
