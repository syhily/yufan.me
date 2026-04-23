import { pendingComments } from '@/services/comments/loader'

export async function PendingComments() {
  const comments = await pendingComments()

  return (
    <div id="recent-comments" className="widget widget-recent-comments">
      <div className="widget-title" data-tippy-content="云中谁寄锦书来？雁字回时，月满西楼。">
        待审评论
      </div>
      <ul id="recent-comments">
        {comments.length > 0 ? (
          comments.map((comment, i) => (
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
          ))
        ) : (
          <div>无待审评论</div>
        )}
      </ul>
    </div>
  )
}
