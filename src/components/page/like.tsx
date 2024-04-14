import React from 'react';

import { queryLikes, queryLikesAndViews } from '@/components/database/query';
import { Post } from '#site/content';

export async function LikeButton({ post }: { post: Post }) {
  const likes = await queryLikes(post.permalink);

  return (
    <div className="post-action text-center mt-5">
      <button
        className={`post-like btn btn-secondary btn-lg btn-rounded` /* add current for showing clicked */}
        title={'Do you like me?'}
        type={'button'}
      >
        <i className="text-lg iconfont icon-heart-fill me-1"></i>
        <span className="like-count">{likes}</span>
      </button>
    </div>
  );
}

export async function LikeIcon({ post }: { post: Post }) {
  const [likes, views] = await queryLikesAndViews(post.permalink);

  return (
    <>
      <div className={`list-like d-inline-block`}>
        <i className="text-md iconfont icon-eye"></i>
        <span className="like-count">{views}</span>
      </div>
      <button className={`list-like d-inline-block` /* add current for showing clicked */}>
        <i className="text-md iconfont icon-heart-fill"></i>
        <span className="like-count">{likes}</span>
      </button>
    </>
  );
}

export async function LikeIconSmall({ post }: { post: Post }) {
  const likes = await queryLikes(post.permalink);

  return (
    <div>
      <i className="text-md iconfont icon-heart-fill"></i> <span className="like-count">{likes}</span>
    </div>
  );
}
