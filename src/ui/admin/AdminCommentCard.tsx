import { useEffect } from 'react'
import { useFetcher } from 'react-router'

import type { AdminComment } from '@/server/comments/types'

import { API_ACTIONS } from '@/client/api/actions'
import { formatLocalDate } from '@/shared/formatter'
import { safeHref } from '@/shared/safe-url'
import { idStr } from '@/shared/tools'
import { CheckIcon, DeleteIcon, EditIcon, LinkIcon, ReplyIcon, UserIcon } from '@/ui/icons/icons'

interface ApiEnvelope<T> {
  data?: T
  error?: { message: string }
}

const ADMIN_DATE_FORMAT = 'yyyy-LL-dd HH:mm'

const APPROVE = API_ACTIONS.comment.approve
const DELETE = API_ACTIONS.comment.delete

export interface AdminCommentCardProps {
  comment: AdminComment
  onEdit: () => void
  onReply: () => void
  onEditUser: () => void
  onApproved: () => void
  onDeleted: () => void
}

export function AdminCommentCard({
  comment,
  onEdit,
  onReply,
  onEditUser,
  onApproved,
  onDeleted,
}: AdminCommentCardProps) {
  const authorHref = safeHref(comment.link)
  const truncatedUa = comment.ua ? (comment.ua.length > 50 ? `${comment.ua.substring(0, 50)}...` : comment.ua) : null

  const approveFetcher = useFetcher<ApiEnvelope<null>>()
  const deleteFetcher = useFetcher<ApiEnvelope<null>>()

  useEffect(() => {
    if (approveFetcher.state !== 'idle' || !approveFetcher.data) return
    if (approveFetcher.data.error) {
      console.error('[admin] approve failed', approveFetcher.data.error)
      return
    }
    onApproved()
  }, [approveFetcher.state, approveFetcher.data, onApproved])

  useEffect(() => {
    if (deleteFetcher.state !== 'idle' || !deleteFetcher.data) return
    if (deleteFetcher.data.error) {
      console.error('[admin] delete failed', deleteFetcher.data.error)
      return
    }
    onDeleted()
  }, [deleteFetcher.state, deleteFetcher.data, onDeleted])

  const handleApprove = () => {
    if (!window.confirm('确定要审核通过这条评论吗？')) return
    void approveFetcher.submit(
      { rid: idStr(comment.id) },
      { method: APPROVE.method, encType: 'application/json', action: APPROVE.path },
    )
  }

  const handleDelete = () => {
    if (!window.confirm('确定要删除这条评论吗？此操作不可恢复！')) return
    void deleteFetcher.submit(
      { rid: idStr(comment.id) },
      { method: DELETE.method, encType: 'application/json', action: DELETE.path },
    )
  }

  return (
    <div className="card mb-3 comment-item" data-comment-id={idStr(comment.id)}>
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
                style={{ width: '100%', height: '100%', borderRadius: '50px', objectFit: 'cover' }}
              />
            </div>
          </div>
          <div className="flex-grow-1">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start mb-2 gap-2">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <strong>{comment.name}</strong>
                  {authorHref && (
                    <a href={authorHref} target="_blank" rel="nofollow noreferrer" className="text-muted small">
                      <LinkIcon />
                    </a>
                  )}
                  {comment.badgeName && (
                    <span
                      className="badge badge-pill fw-bold text-wrap"
                      style={{
                        backgroundColor: comment.badgeColor || '#008c95',
                        color: comment.badgeTextColor || '#ffffff',
                      }}
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
                  <span className="ms-2">
                    {comment.createAt ? formatLocalDate(comment.createAt, ADMIN_DATE_FORMAT) : ''}
                  </span>
                </div>
                {comment.pageTitle && (
                  <div className="text-muted small">
                    <span className="mt-2">{`来自: ${comment.pageTitle}`}</span>
                  </div>
                )}
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm btn-primary edit-comment-btn" onClick={onEdit}>
                  <EditIcon /> 编辑
                </button>
                <button type="button" className="btn btn-sm btn-primary edit-user-btn" onClick={onEditUser}>
                  <UserIcon /> 用户
                </button>
                {comment.isPending && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-success approve-comment-btn"
                    onClick={handleApprove}
                    disabled={approveFetcher.state !== 'idle'}
                  >
                    <CheckIcon /> 审核
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-primary reply-comment-btn" onClick={onReply}>
                  <ReplyIcon /> 回复
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger delete-comment-btn"
                  onClick={handleDelete}
                  disabled={deleteFetcher.state !== 'idle'}
                >
                  <DeleteIcon /> 删除
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
