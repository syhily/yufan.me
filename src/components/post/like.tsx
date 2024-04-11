import React from 'react';

// 工事中
export function Like() {
  return (
    <div className="post-action text-center mt-5">
      <button
        className={`post-like btn btn-secondary btn-lg btn-rounded` /* add current for showing clicked */}
        type={'button'}
      >
        <i className="text-lg iconfont icon-heart-fill me-1"></i>
        <span className="like-count">0</span>
      </button>
    </div>
  );
}
