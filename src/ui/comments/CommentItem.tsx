import { useEffect, useState } from 'react'

import type { CommentEditInput, CommentEditOutput, CommentRawOutput, CommentRidInput } from '@/client/api/action-types'
import type { CommentItem as CommentItemType } from '@/server/comments/types'

import { API_ACTIONS } from '@/client/api/actions'
import { useApiFetcher } from '@/client/api/fetcher'
import { formatLocalDate } from '@/shared/formatter'
import { safeHref } from '@/shared/safe-url'
import { joinUrl } from '@/shared/urls'

export interface CommentItemActions {
  onReply?: (rid: number) => void
  onEdited?: (comment: CommentItemType) => void
  onApproved?: (id: bigint | string) => void
  onDeleted?: (id: bigint | string) => void
}

export interface CommentItemProps {
  depth: number
  comment: CommentItemType
  pending?: boolean
  /** Hoisted once in the page shell so the recursive tree doesn't re-query. */
  admin: boolean
  /** Optional client-island actions wired through `useFetcher`. */
  actions?: CommentItemActions
  /** Optional render function for child comments (used by the stateful island). */
  renderChild?: (child: CommentItemType) => React.ReactNode
  /** Extra node appended inside the top-level comment's children list. */
  childrenTail?: React.ReactNode
  /** Extra node rendered immediately after nested comments. */
  afterComment?: React.ReactNode
}

// Top-level entry: dispatches to `RootComment` (depth 1) or `NestedComment`
// (deeper) so each branch returns a single element. Previously a single
// component used a `<>` fragment workaround for non-depth-1 items, which
// confused TS and DOM-tree readers alike.
export function CommentItem(props: CommentItemProps) {
  return props.depth === 1 ? <RootComment {...props} /> : <NestedComment {...props} />
}

function RootComment(props: CommentItemProps) {
  const { comment, depth, renderChild, childrenTail } = props
  const children = comment.children ?? []
  const renderer =
    renderChild ??
    ((child: CommentItemType) => (
      <CommentItem
        key={String(child.id)}
        comment={child}
        depth={depth + 1}
        admin={props.admin}
        actions={props.actions}
      />
    ))
  return (
    <CommentLi {...props}>
      {(children.length > 0 || childrenTail) && (
        <ul className="children">
          {children.map(renderer)}
          {childrenTail && <li className="comment-reply-form-item">{childrenTail}</li>}
        </ul>
      )}
    </CommentLi>
  )
}

function NestedComment(props: CommentItemProps) {
  const { comment, depth, renderChild, afterComment } = props
  const children = comment.children ?? []
  const renderer =
    renderChild ??
    ((child: CommentItemType) => (
      <CommentItem
        key={String(child.id)}
        comment={child}
        depth={depth + 1}
        admin={props.admin}
        actions={props.actions}
      />
    ))
  return (
    <>
      <CommentLi {...props} />
      {afterComment && <li className="comment-reply-form-item">{afterComment}</li>}
      {children.map(renderer)}
    </>
  )
}

interface CommentLiProps extends CommentItemProps {
  children?: React.ReactNode
}

function CommentLi({ comment, depth, pending, admin, actions, children }: CommentLiProps) {
  const authorHref = safeHref(comment.link)
  const [editing, setEditing] = useState(false)
  return (
    <li id={`user-comment-${comment.id}`} className="comment odd alt thread-odd thread-alt" data-depth={depth}>
      <article id={`div-comment-${comment.id}`} className="comment-body">
        <div
          className="comment-avatar flex-avatar"
          style={{
            backgroundImage: "url('/images/default-avatar.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <img
            alt={comment.name}
            src={joinUrl('/images/avatar', `${comment.userId}.png`)}
            className="avatar avatar-40 photo"
            height={40}
            width={40}
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="comment-inner">
          <div className="comment-author fw-bold">
            {authorHref === undefined ? (
              comment.name
            ) : (
              <a href={authorHref} rel="nofollow noreferrer" target="_blank">
                {comment.name}
              </a>
            )}
            {comment.badgeName && (
              <span
                className="badge comment-author-badge fw-bold"
                style={{
                  backgroundColor: comment.badgeColor || '#008c95',
                  color: comment.badgeTextColor || '#ffffff',
                }}
              >
                {comment.badgeName}
              </span>
            )}
          </div>
          {pending ? (
            <div className="comment-content text-wrap text-break">
              <p className="text-xs text-danger tip-comment-check">您的评论正在等待审核中...</p>
              <div dangerouslySetInnerHTML={{ __html: comment.content ?? '' }} />
            </div>
          ) : (
            <div
              className="comment-content text-wrap text-break"
              dangerouslySetInnerHTML={{ __html: comment.content ?? '' }}
            />
          )}
          {editing && (
            <CommentEditArea
              commentId={comment.id}
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                setEditing(false)
                actions?.onEdited?.(updated)
              }}
            />
          )}
          <CommentFooter comment={comment} admin={admin} actions={actions} onEdit={() => setEditing(true)} />
        </div>
      </article>
      {children}
    </li>
  )
}

interface CommentFooterProps {
  comment: CommentItemType
  admin: boolean
  actions?: CommentItemActions
  onEdit: () => void
}

function CommentFooter({ comment, admin, actions, onEdit }: CommentFooterProps) {
  const approve = useApiFetcher<CommentRidInput, null>(API_ACTIONS.comment.approve, {
    onSuccess: () => actions?.onApproved?.(comment.id),
  })
  const remove = useApiFetcher<CommentRidInput, null>(API_ACTIONS.comment.delete, {
    onSuccess: () => actions?.onDeleted?.(comment.id),
  })

  const handleReply = () => actions?.onReply?.(Number(comment.id))
  const handleApprove = () => approve.submit({ rid: String(comment.id) })
  const handleDelete = () => {
    if (!window.confirm('确定要删除这条评论吗？此操作不可恢复！')) return
    remove.submit({ rid: String(comment.id) })
  }

  return (
    <div className="comment-footer text-xs text-muted">
      <time className="me-2">{formatLocalDate(comment.createAt, 'yyyy-MM-dd HH:mm')}</time>
      <button type="button" className="comment-reply-link me-2" data-rid={comment.id} onClick={handleReply}>
        回复
      </button>
      {admin && (
        <>
          <button type="button" className="comment-edit-link me-2" data-rid={comment.id} onClick={onEdit}>
            编辑
          </button>
          {comment.isPending && (
            <button
              type="button"
              className="comment-approve-link me-2"
              data-rid={comment.id}
              onClick={handleApprove}
              disabled={approve.isPending}
            >
              通过
            </button>
          )}
          <button
            type="button"
            className="comment-delete-link me-2"
            data-rid={comment.id}
            onClick={handleDelete}
            disabled={remove.isPending}
          >
            删除
          </button>
        </>
      )}
    </div>
  )
}

interface CommentEditAreaProps {
  commentId: bigint | string
  onCancel: () => void
  onSaved: (comment: CommentItemType) => void
}

function CommentEditArea({ commentId, onCancel, onSaved }: CommentEditAreaProps) {
  const [value, setValue] = useState<string>('')
  const [loaded, setLoaded] = useState(false)

  const raw = useApiFetcher<never, CommentRawOutput>(API_ACTIONS.comment.getRaw, {
    onSuccess: (payload) => {
      setValue(payload.content || '')
      setLoaded(true)
    },
  })
  const editAction = useApiFetcher<CommentEditInput, CommentEditOutput>(API_ACTIONS.comment.edit, {
    onSuccess: (payload) => onSaved(payload.comment),
  })

  // Load the raw markdown source on first mount.
  const rawLoad = raw.load
  useEffect(() => {
    rawLoad({ rid: String(commentId) })
  }, [commentId, rawLoad])

  const saving = editAction.isPending

  const handleSave = () => {
    if (!value.trim()) return
    editAction.submit({ rid: String(commentId), content: value })
  }

  return (
    <div className="comment-edit-area mt-2">
      <textarea
        className="form-control comment-edit-textarea"
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={!loaded || saving}
      />
      <div className="mt-2 text-end">
        <button
          type="button"
          className="btn btn-primary me-2 comment-save-edit"
          onClick={handleSave}
          disabled={!loaded || saving}
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button type="button" className="btn btn-light comment-cancel-edit" onClick={onCancel} disabled={saving}>
          取消
        </button>
      </div>
    </div>
  )
}
