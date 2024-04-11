import _ from 'lodash';
import Link from 'next/link';
import React from 'react';

import { SearchBar } from '@/components/search/search';
import { options, Post, Tag } from '#site/content';

export function Sidebar({ posts, tags }: { posts: Post[]; tags: Tag[] }) {
  return (
    <aside className="sidebar col-12 col-xl-3 d-none d-xl-block">
      <div className="sidebar-inner block">
        {/* A set of useful sidebar tools. */}
        <SearchBar />
        <RandomPosts posts={posts} />
        <RecentComments />
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

function RecentComments() {
  const hidden = !options.settings.sidebar.comment;
  return (
    <div id="recent-comments" className="widget widget_recent_comments" hidden={hidden}>
      <div className="widget-title">近期评论</div>
      <ul id="recentcomments">
        <li className="recentcomments">
          <span className="comment-author-link">马草原</span> 发表在《<Link href="https://yufan.me/about">关于我</Link>
          {'》'}
        </li>
      </ul>
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
