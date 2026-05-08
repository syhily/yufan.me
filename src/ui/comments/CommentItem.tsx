import { useContext, useEffect, useState } from 'react'

import type { CommentEditInput, CommentEditOutput, CommentRawOutput, CommentRidInput } from '@/shared/api-types'
import type { CommentItem as CommentItemType } from '@/shared/comments'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { formatLocalDate } from '@/shared/formatter'
import { safeHref } from '@/shared/safe-url'
import { joinUrl } from '@/shared/urls'
import { CommentsContext, type CommentsContextValue } from '@/ui/comments/comments-context'
import { useSiteIdentity } from '@/ui/lib/blog-config-context'
import { cn } from '@/ui/lib/cn'
import { publicButtonVariants } from '@/ui/primitives/btn'
import { formControlVariants } from '@/ui/primitives/formControl'

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
  if (ctx !== null) {
    return adapt(ctx, propAdmin)
  }
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

// Nested-replies wrapper. The legacy `.children` rule lived in
// `comments.css`. Preflight ('@layer base') zeros out `<ul>`
// margin/padding/list-style; Tailwind utilities live in `@layer
// utilities`, which beats `@layer base` per the W3C cascade-layers
// spec — so the spacing utilities below do NOT need `!important` to
// win against the Preflight reset (Stage 11 P2). The default-vs-
// mobile margin/padding pair is preserved in two `max-md:` overrides
// instead of the legacy media query.
const childrenListClass = cn('mt-5 ml-14 p-6', 'rounded-sm bg-surface text-sm', 'max-md:mt-4 max-md:ml-9.5 max-md:p-4')

function RootComment({ comment, depth, pending, admin: propAdmin }: CommentItemProps) {
  const leaf = useCommentsLeafContext(propAdmin)
  const children = comment.children ?? []
  const isReplyTarget = leaf.activeReplyToId !== 0 && asKey(comment.id) === asKey(leaf.activeReplyToId)
  const childrenTail = depth === 1 && isReplyTarget ? leaf.replyForm : null
  return (
    <CommentLi comment={comment} depth={depth} pending={pending} admin={propAdmin}>
      {(children.length > 0 || childrenTail) && (
        <ul className={childrenListClass}>
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

// `<li>` is hit by Preflight (`@layer base`), but Tailwind utilities
// land in `@layer utilities` and beat `@layer base` regardless of
// selector specificity — Stage 11 P2 dropped the historical `!`
// modifiers that fought a hypothetical un-layered reset.
//
// depth === 1 keeps the full root chrome (1.5rem mb/pb + bottom
// border collapse on last child); depth > 1 runs inside the nested
// `<ul>` and the legacy override drops to `1rem` margin and removes
// the divider.
function rootCommentLiClass(): string {
  return cn(
    'relative',
    'mb-6 pb-6 max-md:mb-4 max-md:pb-4',
    'border-b border-line',
    'last:mb-0 last:border-b-0 last:pb-0',
  )
}

function nestedCommentLiClass(): string {
  return cn('relative', 'mb-4 pb-0', 'border-b-0', 'last:mb-0')
}

// `<article>` is not in reset.css, so the `display: flex`/min-width:0
// chain travels without `important`.
const commentBodyClass = cn('relative box-border flex max-w-full min-w-0 flex-1')

const commentAuthorClass = cn('inline-flex max-w-full flex-wrap items-center gap-1.5', 'font-bold')

// Depth-aware avatar size + right margin. Default = 40 px square with
// 15 px right margin (root rows on >=768 px). Mobile (<768 px) drops to
// 28×28 + 10 px. Nested rows always render at 30×30 on >=768 px and
// fall to 28×28 on mobile.
function commentAvatarClass(depth: number): string {
  return cn(
    'relative flex shrink-0 items-center justify-center',
    'rounded-full leading-none font-semibold whitespace-nowrap',
    depth === 1 ? 'mr-[15px] size-10 max-md:mr-2.5 max-md:size-7' : 'mr-[15px] size-[30px] max-md:mr-2.5 max-md:size-7',
  )
}

const commentInnerClass = cn('min-w-0 flex-1')

// Mobile overrides on `.comment-inner` (`margin: 0.125rem 0 0`) and
// the nested `.comment-inner` (`margin: 0.25rem 0 0`) historically
// shifted the inner column down by 2-4 px to align with the avatar
// baseline. Inline that on the same node so the cascade is local.
function nestedCommentInnerClass(): string {
  return cn(commentInnerClass, 'mt-1 max-md:mt-0.5')
}

// Root rows had `margin: 0.5rem 0` + `line-height: 1.85`; nested rows
// tightened to `0.375rem` (default) and `0.3125rem` (<=767 px). The
// `comment-content` literal stays on the element because the
// `@utility prose-blog { &.comment-content {…} }` nested compound in
// `tailwind.css` targets it for code-block typography fine-tuning.
function commentContentClass(depth: number): string {
  const base = cn('comment-content', 'prose-blog prose prose-sm max-w-none', 'wrap-break-word whitespace-normal')
  return depth === 1 ? cn(base, 'my-2 leading-[1.85]') : cn(base, 'my-1.5 break-all max-md:my-1.25')
}

function CommentLi({ comment, depth, pending, admin: propAdmin, children }: CommentLiProps) {
  const authorHref = safeHref(comment.link)
  const [editing, setEditing] = useState(false)
  return (
    <li
      id={`user-comment-${comment.id}`}
      className={depth === 1 ? rootCommentLiClass() : nestedCommentLiClass()}
      data-depth={depth}
    >
      <article id={`div-comment-${comment.id}`} className={commentBodyClass}>
        <div
          className={commentAvatarClass(depth)}
          style={{
            backgroundImage: "url('/images/default-avatar.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <img
            alt={comment.name}
            src={joinUrl('/images/avatar', `${comment.userId}.png`)}
            className="size-full rounded-full object-cover"
            height={40}
            width={40}
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className={depth === 1 ? commentInnerClass : nestedCommentInnerClass()}>
          <div className={commentAuthorClass}>
            {authorHref === undefined ? (
              comment.name
            ) : (
              <a href={authorHref} rel="nofollow noreferrer" target="_blank" className="align-middle">
                {comment.name}
              </a>
            )}
            {comment.badgeName && (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center',
                  'px-1.5 py-0.5 leading-badge whitespace-nowrap',
                  'rounded-full text-badge font-bold',
                )}
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
            <div className={commentContentClass(depth)}>
              <p className="tip-comment-check text-xs text-alert">您的评论正在等待审核中...</p>
              <div dangerouslySetInnerHTML={{ __html: comment.content ?? '' }} />
            </div>
          ) : (
            <div className={commentContentClass(depth)} dangerouslySetInnerHTML={{ __html: comment.content ?? '' }} />
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
  const siteIdentity = useSiteIdentity()
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
    if (!window.confirm('确定要删除这条评论吗？此操作不可恢复！')) {
      return
    }
    remove.submit({ rid: String(comment.id) })
  }

  return (
    <div className="flex flex-1 items-center gap-2 text-xs text-ink-muted">
      <time>{formatLocalDate(comment.createAt, 'yyyy-MM-dd HH:mm', siteIdentity)}</time>
      <button
        type="button"
        className={cn(commentFooterButtonClass, 'hover:text-brand')}
        data-rid={comment.id}
        onClick={handleReply}
      >
        回复
      </button>
      {leaf.admin && (
        <>
          <button
            type="button"
            className={cn(commentFooterButtonClass, 'hover:text-alert')}
            data-rid={comment.id}
            onClick={onEdit}
          >
            编辑
          </button>
          {comment.isPending && (
            <button
              type="button"
              className={cn(commentFooterButtonClass, 'text-warn')}
              data-rid={comment.id}
              onClick={handleApprove}
              disabled={approve.isPending}
            >
              通过
            </button>
          )}
          <button
            type="button"
            className={cn(commentFooterButtonClass, 'text-alert')}
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

// Shared base for every `<button>` inside the comment footer. The
// legacy footer-button rule used `transition: all 0.3s linear`; keep
// the 300ms / linear timing exactly so hover/focus states animate at
// the same pace as before. We narrow `all` to `color, background-
// color, border-color` (the only properties that can change here) so
// future `transform`/`opacity` tweaks don't get ridden by a 300ms
// ramp. `bg-transparent` is preserved because reset.css normalizes
// `<button>` to a UA default that varies between engines.
const commentFooterButtonClass = cn(
  'bg-transparent',
  'transition-[color,background-color,border-color] duration-300 ease-linear',
)

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
    if (!value.trim()) {
      return
    }
    editAction.submit({ rid: String(commentId), content: value })
  }

  return (
    <div className="mt-2 block w-full">
      <textarea
        className={formControlVariants({ control: 'textarea' })}
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={!loaded || saving}
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          className={publicButtonVariants({ variant: 'primary' })}
          onClick={handleSave}
          disabled={!loaded || saving}
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          className={publicButtonVariants({ variant: 'light' })}
          onClick={onCancel}
          disabled={saving}
        >
          取消
        </button>
      </div>
    </div>
  )
}
