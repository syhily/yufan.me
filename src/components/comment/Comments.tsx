import type { AstroSession } from 'astro'

import { joinPaths } from '@astrojs/internal-helpers/path'

import config from '@/blog.config'
import { Comment } from '@/components/comment/Comment'
import { userSession } from '@/services/auth/session'
import { increaseViews, loadComments } from '@/services/comments/loader'

export interface CommentsProps {
  commentKey: string
  title: string
  session: AstroSession | undefined
}

export async function Comments({ commentKey, title, session }: CommentsProps) {
  const comments = await loadComments(session, commentKey, title, 0)

  // Increase PV in production for non-admin visitors.
  const user = await userSession(session)
  if (user === undefined || !user.admin) {
    await increaseViews(commentKey, title)
  }

  if (comments == null) {
    return (
      <div id="comments" className="comments pt-5">
        评论加载失败 ❌
      </div>
    )
  }

  const defaultAvatar = joinPaths(import.meta.env.SITE, '/images/default-avatar.png')
  const adminAvatar = user?.admin ? joinPaths(import.meta.env.SITE, `/images/avatar/${user.id}.png`) : undefined

  return (
    <div id="comments" className="comments pt-5">
      <div className="h5 mb-4 comment-total-count">
        评论 <small className="font-theme text-sm">({comments.count})</small>
      </div>
      <div id="respond" className="comment-respond mb-3 mb-md-4">
        <form method="post" action="/comments/new" id="commentForm" className="comment-form">
          <div className="comment-from-avatar flex-avatar">
            {user?.admin ? (
              <img
                alt="头像"
                src={adminAvatar}
                className="avatar avatar-40 photo avatar-default"
                height={40}
                width={40}
                decoding="async"
              />
            ) : (
              <img
                alt="头像"
                src={defaultAvatar}
                data-src={defaultAvatar}
                className="avatar avatar-40 photo avatar-default"
                height={40}
                width={40}
                decoding="async"
              />
            )}
          </div>
          <div className="comment-from-input flex-fill">
            <div className="comment-form-text mb-3">
              <textarea id="content" name="content" className="form-control" rows={3} required />
            </div>
            <div className="comment-form-info row g-2 g-md-3 mb-3">
              {user?.admin ? (
                <input
                  className="form-control"
                  placeholder={user.name}
                  name="name"
                  type="text"
                  readOnly
                  hidden
                  defaultValue={user.name}
                />
              ) : (
                <div className="col">
                  <input className="form-control" placeholder="昵称" name="name" type="text" required />
                </div>
              )}
              {user?.admin ? (
                <input
                  className="form-control"
                  name="email"
                  placeholder={user.email}
                  defaultValue={user.email}
                  type="email"
                  readOnly
                  hidden
                />
              ) : (
                <div className="col-12 col-md-6">
                  <input className="form-control" name="email" placeholder="邮箱" type="email" required />
                </div>
              )}
              <input hidden name="page_key" type="text" defaultValue={commentKey} />
              <input hidden name="rid" type="text" defaultValue="0" />
              {user?.admin ? (
                <input
                  className="form-control"
                  placeholder={user.website}
                  defaultValue={user.website}
                  name="link"
                  type="url"
                  readOnly
                  hidden
                />
              ) : (
                <div className="col-12">
                  <input className="form-control" placeholder="网址" name="link" type="url" />
                </div>
              )}
            </div>
            <div className="form-submit text-end">
              <input
                type="button"
                id="cancel-comment-reply-link"
                className="btn btn-light me-1"
                value="再想想"
                hidden
              />
              <input name="submit" type="submit" id="submit" className="btn btn-primary" value="发表评论" />
            </div>
          </div>
        </form>
      </div>
      <ul className="comment-list">
        <Comment comments={comments} admin={user?.admin === true} />
      </ul>
      {config.settings.comments.size < comments.roots_count && (
        <div className="text-center mt-3 mt-md-4">
          <button
            id="comments-next-button"
            data-key={commentKey}
            data-size={config.settings.comments.size}
            data-offset={config.settings.comments.size}
            type="button"
            className="btn btn-light"
          >
            加载更多
          </button>
        </div>
      )}
    </div>
  )
}
