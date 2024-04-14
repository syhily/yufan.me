import _ from 'lodash';
import Link from 'next/link';
import React, { Suspense } from 'react';

import { latestComments } from '@/components/database/query';
import { SearchBar } from '@/components/search/search';
import { options, Post, Tag } from '#site/content';

export function Sidebar({ posts, tags }: { posts: Post[]; tags: Tag[] }) {
  return (
    <aside className="sidebar col-12 col-xl-3 d-none d-xl-block">
      <div className="sidebar-inner block">
        {/* A set of useful sidebar tools. */}
        <SearchBar />
        <RandomPosts posts={posts} />
        <Suspense fallback={<div></div>}>
          <RecentComments />
        </Suspense>
        <RandomTags tags={tags} />
      </div>
    </aside>
  );
}

function RandomPosts({ posts }: { posts: Post[] }) {
  const randomSize = options.settings.sidebar.post;
  if (randomSize <= 0) {
    return <></>;
  }

  const randomPosts = _.sampleSize(posts, randomSize).map((post) => (
    <li key={post.slug}>
      <Link href={post.permalink} title={post.title}>
        {post.title}
      </Link>
    </li>
  ));

  return (
    <div id="recent_posts" className="widget widget_recent_entries">
      <div className="widget-title">随机文章</div>
      <ul className="line">{randomPosts}</ul>
    </div>
  );
}

async function RecentComments() {
  const commentSize = options.settings.sidebar.comment;
  if (commentSize <= 0) {
    return <></>;
  }

  const comments = (await latestComments()).map((comment) => (
    <li className="recentcomments" key={comment.permalink}>
      <span className="comment-author-link">{comment.author}</span> 发表在《
      <Link href={comment.permalink}>{comment.title}</Link>
      {'》'}
    </li>
  ));

  return (
    <div id="recent-comments" className="widget widget_recent_comments">
      <div className="widget-title">近期评论</div>
      <ul id="recentcomments">{comments}</ul>
    </div>
  );
}

function RandomTags({ tags }: { tags: Tag[] }) {
  const randomSize = options.settings.sidebar.tag;
  if (randomSize <= 0) {
    return <></>;
  }

  const sampleTags = _.sampleSize(tags, randomSize).map((tag) => (
    <Link key={tag.name} href={`/tags/${tag.slug}`} className="tag-cloud-link" title={`${tag}(${tag.count} 篇文章)`}>
      {tag.name}
    </Link>
  ));

  return (
    <div id="tag_cloud" className="widget widget_tag_cloud">
      <div className="widget-title">文章标签</div>
      <div className="tagcloud">{sampleTags}</div>
    </div>
  );
}
