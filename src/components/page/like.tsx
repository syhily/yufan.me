'use server';
import React from 'react';

import { queryLikes, queryLikesAndViews } from '@/components/database/query';
import { Post } from '#site/content';

export async function LikeIcon({ post }: { post: Post }) {
  const [likes, views] = await queryLikesAndViews(post.permalink);

  return (
    <>
      <div className="list-like d-inline-block">
        <i className="text-md iconfont icon-eye"></i>
        <span className="like-count">{views}</span>
      </div>
      <div className="list-like d-inline-block">
        <i className="text-md iconfont icon-heart-fill"></i>
        <span className="like-count">{likes}</span>
      </div>
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
