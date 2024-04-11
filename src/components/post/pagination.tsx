import Image from 'next/image';
import Link from 'next/link';

import { QueryCategory } from '@/components/category/query';
import { Navigation } from '@/components/navigation/navigation';
import { formatShowDate } from '@/utils/formatter';
import { slicePosts } from '@/utils/list';
import { options, Post } from '#site/content';

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
        <Link href={post.permalink} className="media-content">
          <Image
            src={post.cover.src}
            width={post.cover.width}
            height={post.cover.height}
            placeholder="blur"
            blurDataURL={post.cover.blurDataURL}
            alt={post.title}
          />
        </Link>
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
            {/* TODO The like button is WIP. */}
            <button className={`list-like d-inline-block` /* add current for showing clicked */}>
              <i className="text-md iconfont icon-heart-fill"></i>
              <span className="like-count">0</span>
            </button>
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
          <Link href={post.permalink} className="media-content">
            <Image
              src={post.cover.src}
              alt={post.title}
              placeholder="blur"
              blurDataURL={post.cover.blurDataURL}
              width={post.cover.width}
              height={post.cover.height}
            />
            <div className="overlay"></div>
          </Link>
        </div>
        <div className="list-content ">
          <Link href={post.permalink} className="list-body">
            <div className="list-title h6 h-2x">{post.title}</div>
            <div className="list-meta font-number d-flex flex-fill text-muted text-sm">
              <span className="d-inline-block">{formatShowDate(post.date)}</span>
              <div className="flex-fill"></div>
              <div>
                {/* TODO Support like. */}
                {/* TODO Add view count. */}
                <i className="text-md iconfont icon-heart-fill"></i> <span className="like-count">0</span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
