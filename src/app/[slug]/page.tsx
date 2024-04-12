import { join } from 'node:path';

import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import React from 'react';

import { ArtalkComment } from '@/components/comment/artalk';
import { MDXContent } from '@/components/mdx/content';
import { FriendLinks } from '@/components/page/link';
import { options, pages, posts } from '#site/content';

function getPage(slug: string) {
  const page = pages.find((page) => page.slug === slug);
  if (!page) {
    const post = posts.find((post) => post.slug === slug);
    if (post) {
      // Keep the link of my old posts.
      return permanentRedirect(post.permalink);
    } else {
      return notFound();
    }
  }

  return page;
}

export function generateStaticParams() {
  const oldPostSlugs = posts.map(({ slug }) => ({ slug }));
  return pages.map(({ slug }) => ({ slug })).concat(oldPostSlugs);
}

export async function generateMetadata({ params: { slug } }: SlugProps): Promise<Metadata> {
  const page = getPage(slug);
  const cover = page.cover.src.startsWith('http') ? page.cover.src : join(options.website, page.cover.src);

  return {
    title: page.title,
    metadataBase: new URL(options.website),
    openGraph: {
      title: page.title,
      description: options.description,
      type: 'article',
      publishedTime: page.date,
      url: page.permalink,
      images: [
        {
          url: cover,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: options.description,
      images: [cover],
    },
  };
}

export default function PageComponent({ params: { slug } }: Readonly<SlugProps>) {
  const page = getPage(slug);
  if (!page) {
    return notFound();
  }

  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      <div className="container">
        <div className="post">
          <h1 className="post-title mb-3 mb-xl-4">{page.title}</h1>
          <div className="post-content">
            <div className="nc-light-gallery">
              <MDXContent code={page.content} />
            </div>
          </div>
          <FriendLinks hidden={!page.friend} />
          <ArtalkComment id={page.slug} title={page.title} hidden={page.comments} />
        </div>
      </div>
    </div>
  );
}
