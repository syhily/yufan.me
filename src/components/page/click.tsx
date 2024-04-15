'use client';
import React, { useState } from 'react';

import { Post } from '#site/content';

const fetcher = (id: string) => fetch('/api/likes?permalink=' + id).then((res) => res.json());
const updater = (id: string) =>
  fetch('/api/likes', { method: 'POST', body: JSON.stringify({ permalink: id }) }).then((res) => res.json());

export function LikeButton({ post }: { post: Post }) {
  const [likes, setLikes] = useState(0);
  const [updated, setUpdated] = useState(false);

  fetcher(post.permalink).then((data) => setLikes(data['likes']));

  async function updateLikes(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();

    if (updated) {
      return;
    }

    const { likes } = await updater(post.permalink);
    setLikes(likes);
    setUpdated(true);
  }

  return (
    <div className="post-action text-center mt-5">
      <button
        className={`post-like btn btn-secondary btn-lg btn-rounded ${updated && 'current'}`}
        title={'Do you like me?'}
        type={'button'}
        onClick={updateLikes}
      >
        <i className="text-lg iconfont icon-heart-fill me-1"></i>
        <span className="like-count">{likes}</span>
      </button>
    </div>
  );
}
