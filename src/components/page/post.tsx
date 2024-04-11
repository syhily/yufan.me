import Link from 'next/link';
import React from 'react';

import { Navigation } from '@/components/navigation/navigation';
import { PinnedCategories, QueryCategory } from '@/components/page/category';
import { LikeIcon, LikeIconSmall } from '@/components/page/like';
import { Sidebar } from '@/components/sidebar/sidebar';
import { formatShowDate } from '@/utils/formatter';
import { slicePosts } from '@/utils/list';
import { options, Post, Tag } from '#site/content';

export function ListPosts({ posts, tags, pageNum }: { posts: Post[]; tags: Tag[]; pageNum: number }) {
  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      <FeaturePosts posts={posts} />
      <div className="container">
        <div className="row">
          <PostPagination pageNum={pageNum} posts={posts} />
          <Sidebar posts={posts} tags={tags} />
        </div>
        <PinnedCategories />
      </div>
    </div>
  );
}

export function FeaturePosts({ posts }: { posts: Post[] }) {
  const featurePosts = options.settings.post.feature ?? [];
  const metas: Post[] = featurePosts
    .map((slug) => posts.find((post) => post.slug === slug))
    .flatMap((post) => (post == null ? [] : [post]))
    .slice(0, 3);

  return (
    <div className="list-top-pushes mb-3 mb-md-4 mb-lg-5">
      <div className="container">
        <div className="row gx-2 gx-md-3 list-grouped">
          <div className="col-lg-8">
            <FeaturePost post={metas[0]} />
          </div>
          <div className="col-lg-4 d-flex flex-column mt-2 mt-md-3 mt-lg-0">
            <div className="row g-2 g-md-3">
              <div className="col-6 col-lg-12">
                <FeaturePost post={metas[1]} />
              </div>
              <div className="col-6 col-lg-12">
                <FeaturePost post={metas[2]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturePost({ post }: { post: Post; first?: boolean }) {
  return (
    <div className="list-item list-nice-overlay" key={post.slug}>
      <div className="media media-3x2">
        <Link
          href={post.permalink}
          className={'media-content'}
          style={{
            backgroundImage: `url('https://cat.yufan.me${post.cover.src}-upyun520/both/600x400/quality/100/unsharp/true/progressive/true')`,
          }}
        >
          <div className="overlay"></div>
        </Link>
      </div>
      <div className="list-content p-2 p-md-3">
        <div className="list-body">
          <Link href={post.permalink} className="list-title h5 h-2x m-0">
            {post.title}
          </Link>
        </div>
      </div>
    </div>
  );
}

// The pageNum starts from 1.
export function PostPagination({ pageNum, posts }: { pageNum: number; posts: Post[] }) {
  const { currentPosts, totalPage } = slicePosts(posts, pageNum, options.settings.pagination.posts);

  return (
    <div className="content-wrapper content-wrapper col-12 col-xl-9">
      <PostCards posts={currentPosts} />
      <Navigation current={pageNum} total={totalPage} rootPath={'/'} />
    </div>
  );
}

function PostCards({ posts }: { posts: Post[] }) {
  const list = posts.map((post) => <PostCard post={post} key={post.slug} />);
  return <div className="list-grid">{list}</div>;
}

function PostCard({ post }: { post: Post }) {
  const category = QueryCategory({ name: post.category });
  return (
    <div className="list-item block">
      <div className="media media-3x2 col-6 col-md-5">
        <Link
          href={post.permalink}
          className="media-content"
          style={{
            backgroundImage: `url('https://cat.yufan.me${post.cover.src}-upyun520/both/450x300/quality/100/unsharp/true/progressive/true')`,
          }}
        />
        <div className="media-overlay overlay-top">
          <Link
            className="d-none d-md-inline-block badge badge-md bg-white-overlay"
            href={category ? category.permalink : ''}
          >
            {post.category}
          </Link>
        </div>
      </div>
      <div className="list-content">
        <div className="list-body">
          <Link href={post.permalink} className="list-title h5">
            <div className="h-2x">{post.title}</div>
          </Link>
          <div className="d-none d-md-block list-desc text-secondary text-md mt-3">
            <div className="h-2x">{post.summary ?? post.excerpt}</div>
          </div>
        </div>
        <div className="list-footer">
          <div className="d-flex flex-fill align-items-center text-muted text-sm">
            <div className="flex-fill d-none d-md-block">{formatShowDate(post.date)}</div>
            <LikeIcon post={post} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PostSquare({ post, first }: { post: Post; first: boolean }) {
  return (
    <div className={first ? 'col-12 col-md-8 col-xl-6' : 'col-6 col-md-4 col-xl-3'}>
      <div className="list-item list-nice-overlay">
        <div className={`media ${first ? 'media-36x17' : ''}`}>
          <Link
            href={post.permalink}
            className="media-content"
            style={{
              backgroundImage: `url('https://cat.yufan.me${post.cover.src}-upyun520/both/${first ? '600' : '300'}x300/quality/100/unsharp/true/progressive/true')`,
            }}
          >
            <div className="overlay"></div>
          </Link>
        </div>
        <div className="list-content ">
          <Link href={post.permalink} className="list-body">
            <div className="list-title h6 h-2x">{post.title}</div>
            <div className="list-meta font-number d-flex flex-fill text-muted text-sm">
              <span className="d-inline-block">{formatShowDate(post.date)}</span>
              <div className="flex-fill"></div>
              <LikeIconSmall post={post} />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
