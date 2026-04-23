import type { LatestComment } from '@/services/comments/types'

import config from '@/blog.config'

export interface RecentCommentsProps {
  comments: LatestComment[]
}

export function RecentComments({ comments }: RecentCommentsProps) {
  if (config.settings.sidebar.comment <= 0 || comments.length === 0) return null

  return (
    <div id="recent-comments" className="widget widget-recent-comments">
      <div className="widget-title" data-tippy-content="欲寄彩笺兼尺素，山长水阔知何处？">
        雁过留声
      </div>
      <ul id="recent-comments">
        {comments.map((comment, i) => (
          <li key={i} className="recent-comments">
            <span className="comment-author-link">
              {comment.authorLink === '' ? (
                comment.author
              ) : (
                <a href={comment.authorLink} target="_blank" rel="nofollow">
                  {comment.author}
                </a>
              )}
            </span>
            {' 发表在《'}
            <a href={comment.permalink}>{comment.title}</a>》
          </li>
        ))}
      </ul>
    </div>
  )
}
