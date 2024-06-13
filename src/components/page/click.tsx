'use client';
import React, { useState } from 'react';

import { options, Post } from '#site/content';

export function LikeButton({ post }: { post: Post }) {
  const [likes, setLikes] = useState(0);
  const [updated, setUpdated] = useState(false);

  fetch(options.website + '/api/likes?permalink=' + post.permalink)
    .then((res) => res.json())
    .then((data) => setLikes(data['likes']));

  function updateLikes(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();

    if (updated) {
      return;
    }

    setUpdated(true);
    setLikes(likes + 1);

    fetch(options.website + '/api/likes', {
      method: 'POST',
      body: JSON.stringify({ permalink: post.permalink }),
    })
      .then((res) => res.json())
      .then(({ likes }) => {
        setLikes(likes);
      });
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
