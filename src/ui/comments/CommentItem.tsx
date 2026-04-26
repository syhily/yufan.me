import { useContext, useEffect, useState } from 'react'

import type { CommentEditInput, CommentEditOutput, CommentRawOutput, CommentRidInput } from '@/client/api/action-types'
import type { CommentItem as CommentItemType } from '@/server/comments/types'

import { API_ACTIONS } from '@/client/api/actions'
import { useApiFetcher } from '@/client/api/fetcher'
import { formatLocalDate } from '@/shared/formatter'
import { safeHref } from '@/shared/safe-url'
import { joinUrl } from '@/shared/urls'
import { CommentsContext, type CommentsContextValue } from '@/ui/comments/comments-context'

export interface CommentItemProps {
  depth: number
  comment: CommentItemType
  /** Renders the "等待审核" hint over the body. Falls back to `comment.isPending`. */
  pending?: boolean
  /**
   * Standalone admin override. When `<CommentItem>` is rendered outside the
   * `<Comments>` orchestrator (e.g. SSR snapshot tests), callers pass this
   * directly; in compound usage the value lifts from context.
   */
  admin?: boolean
}

// Read-only consumer that returns sensible defaults when no `<Comments>`
// orchestrator is present (test snapshots and the legacy `<Comment>` SSR
// helper). Compound usage is unaffected — the orchestrator always provides
// the full context value, so leaf components see real callbacks there.
function useCommentsLeafContext(propAdmin: boolean | undefined): {
  admin: boolean
  activeReplyToId: number
  replyForm: React.ReactNode
  onReply: (rid: number) => void
  onEdited: (comment: CommentItemType) => void
  onApproved: (id: bigint | string) => void
  onDeleted: (id: bigint | string) => void
} {
  const ctx = useContext(CommentsContext)
  if (ctx !== null) return adapt(ctx, propAdmin)
  return {
    admin: propAdmin === true,
    activeReplyToId: 0,
    replyForm: null,
    onReply: noop,
    onEdited: noop,
    onApproved: noop,
    onDeleted: noop,
  }
}

function adapt(ctx: CommentsContextValue, propAdmin: boolean | undefined) {
  return {
    admin: propAdmin === undefined ? ctx.admin : propAdmin,
    activeReplyToId: ctx.activeReplyToId,
    replyForm: ctx.replyForm,
    onReply: ctx.onReply,
    onEdited: ctx.onEdited,
    onApproved: ctx.onApproved,
    onDeleted: ctx.onDeleted,
  }
}

function noop() {}

// Self-recursive comment node. The previous implementation accepted a
// `renderChild` render-prop and an `actions` bag so the orchestrator could
// override behaviour for every depth. Now that the parent `<Comments>`
// publishes the same orchestration via `CommentsContext` (see
// `vercel-composition-patterns/architecture-prefer-children-over-render-props`),
// each `CommentItem` recurses by component name and reads what it needs
// directly from context. The `admin` and `pending` props remain on the
// public surface for callers that render `<CommentItem>` standalone (SSR
// snapshots, the legacy `<Comment>` helper).
export function CommentItem(props: CommentItemProps) {
  return props.depth === 1 ? <RootComment {...props} /> : <NestedComment {...props} />
}

function RootComment({ comment, depth, pending, admin: propAdmin }: CommentItemProps) {
  const leaf = useCommentsLeafContext(propAdmin)
  const children = comment.children ?? []
  const isReplyTarget = leaf.activeReplyToId !== 0 && asKey(comment.id) === asKey(leaf.activeReplyToId)
  const childrenTail = depth === 1 && isReplyTarget ? leaf.replyForm : null
  return (
    <CommentLi comment={comment} depth={depth} pending={pending} admin={propAdmin}>
      {(children.length > 0 || childrenTail) && (
        <ul className="children">
          {children.map((child) => (
            <CommentItem key={asKey(child.id)} comment={child} depth={depth + 1} admin={propAdmin} />
          ))}
          {childrenTail && <li className="comment-reply-form-item">{childrenTail}</li>}
        </ul>
      )}
    </CommentLi>
  )
}

function NestedComment({ comment, depth, pending, admin: propAdmin }: CommentItemProps) {
  const leaf = useCommentsLeafContext(propAdmin)
  const children = comment.children ?? []
  const isReplyTarget = leaf.activeReplyToId !== 0 && asKey(comment.id) === asKey(leaf.activeReplyToId)
  const afterComment = depth !== 1 && isReplyTarget ? leaf.replyForm : null
  return (
    <>
      <CommentLi comment={comment} depth={depth} pending={pending} admin={propAdmin} />
      {afterComment && <li className="comment-reply-form-item">{afterComment}</li>}
      {children.map((child) => (
        <CommentItem key={asKey(child.id)} comment={child} depth={depth + 1} admin={propAdmin} />
      ))}
    </>
  )
}

interface CommentLiProps extends CommentItemProps {
  children?: React.ReactNode
}

function CommentLi({ comment, depth, pending, admin: propAdmin, children }: CommentLiProps) {
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
              onSaved={() => setEditing(false)}
            />
          )}
          <CommentFooter comment={comment} admin={propAdmin} onEdit={() => setEditing(true)} />
        </div>
      </article>
      {children}
    </li>
  )
}

function asKey(value: bigint | string | number): string {
  return String(value)
}

interface CommentFooterProps {
  comment: CommentItemType
  admin: boolean | undefined
  onEdit: () => void
}

function CommentFooter({ comment, admin: propAdmin, onEdit }: CommentFooterProps) {
  const leaf = useCommentsLeafContext(propAdmin)
  const approve = useApiFetcher<CommentRidInput, null>(API_ACTIONS.comment.approve, {
    onSuccess: () => leaf.onApproved(comment.id),
  })
  const remove = useApiFetcher<CommentRidInput, null>(API_ACTIONS.comment.delete, {
    onSuccess: () => leaf.onDeleted(comment.id),
  })

  const handleReply = () => leaf.onReply(Number(comment.id))
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
      {leaf.admin && (
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
  const leaf = useCommentsLeafContext(undefined)
  const [value, setValue] = useState<string>('')
  const [loaded, setLoaded] = useState(false)

  const raw = useApiFetcher<never, CommentRawOutput>(API_ACTIONS.comment.getRaw, {
    onSuccess: (payload) => {
      setValue(payload.content || '')
      setLoaded(true)
    },
  })
  const editAction = useApiFetcher<CommentEditInput, CommentEditOutput>(API_ACTIONS.comment.edit, {
    onSuccess: (payload) => {
      // Drive the parent reducer first so the freshly-edited content appears
      // in the tree before the editor closes (keeps the post-save flicker
      // confined to the edit area instead of the whole row).
      leaf.onEdited(payload.comment)
      onSaved(payload.comment)
    },
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
