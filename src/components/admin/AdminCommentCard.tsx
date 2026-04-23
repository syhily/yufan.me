import type { AdminComment } from '@/services/comments/types'

import { Icon } from '@/assets/icons/Icon'

export interface AdminCommentCardProps {
  comment: AdminComment
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminCommentCard({ comment }: AdminCommentCardProps) {
  const truncatedUa = comment.ua ? (comment.ua.length > 50 ? `${comment.ua.substring(0, 50)}...` : comment.ua) : null

  return (
    <div className="card mb-3 comment-item" data-comment-id={String(comment.id)}>
      <div className="card-body">
        <div className="d-flex gap-3">
          <div className="flex-shrink-0">
            <div
              className="flex-avatar"
              style={{
                width: '50px',
                height: '50px',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundImage: "url('/images/default-avatar.png')",
              }}
            >
              <img
                src={`/images/avatar/${comment.userId}.png`}
                alt={comment.name}
                {...({ onerror: "this.style.display='none'" } as { onerror: string })}
                style={{ width: '100%', height: '100%', borderRadius: '50px', objectFit: 'cover' }}
              />
            </div>
          </div>
          <div className="flex-grow-1">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start mb-2 gap-2">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <strong>{comment.name}</strong>
                  {comment.link && (
                    <a href={comment.link} target="_blank" rel="nofollow" className="text-muted small">
                      <Icon name="link" />
                    </a>
                  )}
                  {comment.badgeName && (
                    <span
                      className="badge badge-pill fw-bold text-wrap"
                      style={{ backgroundColor: comment.badgeColor || '#008c95' }}
                    >
                      {comment.badgeName}
                    </span>
                  )}
                  {comment.isPending ? (
                    <span className="badge badge-warning">待审核</span>
                  ) : (
                    <span className="badge badge-light">已审核</span>
                  )}
                </div>
                <div className="text-muted small">
                  <span>{comment.email}</span>
                  <span className="ms-2">{formatDate(comment.createAt)}</span>
                </div>
                {comment.pageTitle && (
                  <div className="text-muted small">
                    <span className="mt-2">{`来自: ${comment.pageTitle}`}</span>
                  </div>
                )}
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-sm btn-primary edit-comment-btn" data-comment-id={String(comment.id)}>
                  <Icon name="edit" /> 编辑
                </button>
                <button
                  className="btn btn-sm btn-primary edit-user-btn"
                  data-user-id={String(comment.userId)}
                  data-user-name={comment.name}
                  data-user-email={comment.email}
                  data-user-link={comment.link || ''}
                  data-badge-name={comment.badgeName || ''}
                  data-badge-color={comment.badgeColor || ''}
                >
                  <Icon name="user" /> 用户
                </button>
                {comment.isPending && (
                  <button
                    className="btn btn-sm btn-outline-success approve-comment-btn"
                    data-comment-id={String(comment.id)}
                  >
                    <Icon name="check" /> 审核
                  </button>
                )}
                <button
                  className="btn btn-sm btn-primary reply-comment-btn"
                  data-comment-id={String(comment.id)}
                  data-page-key={comment.pageKey}
                >
                  <Icon name="reply" /> 回复
                </button>
                <button
                  className="btn btn-sm btn-outline-danger delete-comment-btn"
                  data-comment-id={String(comment.id)}
                >
                  <Icon name="delete" /> 删除
                </button>
              </div>
            </div>
            <div
              className="comment-content mb-2"
              style={{ lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: comment.content ?? '' }}
            />
            {(comment.ua || comment.ip) && (
              <div className="text-muted small">
                {truncatedUa && <span>{`UA: ${truncatedUa}`}</span>}
                {comment.ip && <span className="ms-2">{`IP: ${comment.ip}`}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
