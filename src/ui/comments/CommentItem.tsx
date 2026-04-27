import { clsx } from 'clsx'
import { type CSSProperties, useContext, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import type { CommentEditInput, CommentEditOutput, CommentRawOutput, CommentRidInput } from '@/client/api/action-types'
import type { CommentItem as CommentItemType } from '@/server/comments/types'

import { API_ACTIONS } from '@/client/api/actions'
import { useApiFetcher } from '@/client/api/fetcher'
import { formatLocalDate } from '@/shared/formatter'
import { safeHref } from '@/shared/safe-url'
import { joinUrl } from '@/shared/urls'
import { CommentBody } from '@/ui/comments/CommentBody'
import { CommentsContext, type CommentsContextValue } from '@/ui/comments/comments-context'
import { badgeVariants } from '@/ui/primitives/Badge'
import { Button } from '@/ui/primitives/Button'
import { Textarea } from '@/ui/primitives/Textarea'

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

// The badge palette comes from the comment author's `badgeColor` /
// `commentBadgeTextColor()` pair when available. When either side is
// `null` we keep the inline style attribute empty so the surface uses
// the `--badge-color` / `--badge-fg` defaults declared in `globals.css`
// instead of stamping a literal hex into every JSX node.
function badgeStyle(backgroundColor: string | null | undefined, color: string | null | undefined): CSSProperties {
  const overrides = {} as Record<'--badge-color' | '--badge-fg', string>
  if (backgroundColor !== null && backgroundColor !== undefined && backgroundColor !== '') {
    overrides['--badge-color'] = backgroundColor
  }
  if (color !== null && color !== undefined && color !== '') {
    overrides['--badge-fg'] = color
  }
  return overrides as CSSProperties
}

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
        <ul className="children text-sm p-6 mt-5 ml-14 rounded-sm bg-surface-muted max-md:p-4 max-md:mt-4 max-md:ml-[2.375rem]">
          {children.map((child) => (
            <CommentItem key={asKey(child.id)} comment={child} depth={depth + 1} admin={propAdmin} />
          ))}
          {childrenTail && <li>{childrenTail}</li>}
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
      {afterComment && <li>{afterComment}</li>}
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
    <li
      id={`user-comment-${comment.id}`}
      className="relative mb-6 pb-6 border-b border-border last:m-0 last:p-0 last:border-b-0 max-md:mb-4 max-md:pb-4"
      data-depth={depth}
    >
      <article id={`div-comment-${comment.id}`} className="relative flex flex-auto min-w-0 max-w-full box-border">
        <div
          className="flex-avatar w-10 h-10 mr-[0.9375rem] [.children_&]:w-[30px] [.children_&]:h-[30px] max-md:w-7 max-md:h-7 max-md:mr-2.5"
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
        <div className="flex-auto min-w-0 [.children_&]:mt-1 max-md:mt-0.5">
          <div className="font-bold inline-flex flex-wrap items-center gap-1.5 max-w-full [&_a]:align-middle">
            {authorHref === undefined ? (
              comment.name
            ) : (
              <a href={authorHref} rel="nofollow noreferrer" target="_blank">
                {comment.name}
              </a>
            )}
            {comment.badgeName && (
              <span
                className={twMerge(
                  clsx(
                    badgeVariants(),
                    'inline-flex flex-none items-center px-1.5 py-0.5 leading-[1.2] whitespace-nowrap rounded-full font-bold bg-[color:var(--badge-color)] text-[color:var(--badge-fg)]',
                  ),
                )}
                style={badgeStyle(comment.badgeColor, comment.badgeTextColor)}
              >
                {comment.badgeName}
              </span>
            )}
          </div>
          <div className="prose-host whitespace-normal break-words my-2 leading-[1.85] [.children_&]:my-1.5 [.children_&]:break-all max-md:[.children_&]:my-1.5">
            {pending && <p className="text-xs text-danger">您的评论正在等待审核中...</p>}
            <CommentBody compiled={comment.bodyCompiled} />
          </div>
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
    <div className="text-xs text-foreground-muted flex flex-auto items-center [&_button]:bg-transparent [&_button]:transition-all [&_button]:duration-300 [&_button]:ease-linear">
      <time className="me-2 flex-auto [.children_&]:flex-none">
        {formatLocalDate(comment.createAt, 'yyyy-MM-dd HH:mm')}
      </time>
      <button type="button" className="me-2 hover:text-accent" data-rid={comment.id} onClick={handleReply}>
        回复
      </button>
      {leaf.admin && (
        <>
          <button type="button" className="me-2 hover:text-danger" data-rid={comment.id} onClick={onEdit}>
            编辑
          </button>
          {comment.isPending && (
            <button
              type="button"
              className="me-2 text-warning"
              data-rid={comment.id}
              onClick={handleApprove}
              disabled={approve.isPending}
            >
              通过
            </button>
          )}
          <button
            type="button"
            className="me-2 text-danger"
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
    <div className="mt-2 block w-full">
      <Textarea rows={4} value={value} onChange={(e) => setValue(e.target.value)} disabled={!loaded || saving} />
      <div className="mt-2 text-right">
        <Button className="me-2" onClick={handleSave} disabled={!loaded || saving}>
          {saving ? '保存中...' : '保存'}
        </Button>
        <Button tone="neutral" onClick={onCancel} disabled={saving}>
          取消
        </Button>
      </div>
    </div>
  )
}
