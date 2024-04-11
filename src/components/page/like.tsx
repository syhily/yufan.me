import React from 'react';

import { Post } from '#site/content';

// TODO Like button
export function LikeButton() {
  return (
    <div className="post-action text-center mt-5">
      <button
        className={`post-like btn btn-secondary btn-lg btn-rounded` /* add current for showing clicked */}
        title={'Do you like me?'}
        type={'button'}
      >
        <i className="text-lg iconfont icon-heart-fill me-1"></i>
        <span className="like-count">0</span>
      </button>
    </div>
  );
}

// TODO The like button is WIP.
export function LikeIcon({ post }: { post: Post }) {
  return (
    <button className={`list-like d-inline-block` /* add current for showing clicked */}>
      <i className="text-md iconfont icon-heart-fill"></i>
      <span className="like-count">0</span>
    </button>
  );
}

// TODO Small like icon.
export function LikeIconSmall({ post }: { post: Post }) {
  return (
    <div>
      <i className="text-md iconfont icon-heart-fill"></i> <span className="like-count">0</span>
    </div>
  );
}
