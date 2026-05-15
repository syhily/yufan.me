import { XIcon } from 'lucide-react'
import { use, useEffect, useState } from 'react'
import { useFetcher, useRevalidator } from 'react-router'

import type { CommentEditInput, CommentEditOutput, CommentRawOutput, CommentRidInput } from '@/client/api/legacy-types'
import type { ApiEnvelope } from '@/shared/api-envelope'
import type { CommentItem as CommentItemType } from '@/shared/comments'
import type { CommentBody } from '@/shared/pt/comment-schema'

import { API_ACTIONS, useApiFetcher, useFetcherResult } from '@/client/api/fetcher'
import { formatLocalDate } from '@/shared/formatter'
import { safeHref } from '@/shared/safe-url'
import { joinUrl } from '@/shared/urls'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/ui/components/alert-dialog'
import { Button } from '@/ui/components/button'
import { useSiteIdentity } from '@/ui/lib/blog-config-context'
import { cn } from '@/ui/lib/cn'
import { PortableTextBody } from '@/ui/pt/render'
import { CommentBodyEditor, EMPTY_COMMENT_BODY, isCommentBodyBlank } from '@/ui/public/comments/CommentBodyEditor'
import { CommentsContext, type CommentsContextValue } from '@/ui/public/comments/comments-context'

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
  myCommentIds: Set<string>
  myCommentExpiresAt: Map<string, number>
  currentUserId: string | null
  activeReplyToId: number
  replyForm: React.ReactNode
  onReply: (rid: number) => void
  onEdited: (comment: CommentItemType) => void
  onApproved: (id: bigint | string) => void
  onDeleted: (id: bigint | string) => void
  onDismissMyComment: (id: bigint | string) => void
} {
  const ctx = use(CommentsContext)
  if (ctx !== null) {
    return adapt(ctx, propAdmin)
  }
  return {
    admin: propAdmin === true,
    myCommentIds: new Set(),
    myCommentExpiresAt: new Map(),
    currentUserId: null,
    activeReplyToId: 0,
    replyForm: null,
    onReply: noop,
    onEdited: noop,
    onApproved: noop,
    onDeleted: noop,
    onDismissMyComment: noop,
  }
}

function adapt(ctx: CommentsContextValue, _propAdmin: boolean | undefined) {
  // When a CommentsContext is mounted, it is the single source of truth.
  // The legacy `<Comment>` SSR helper and snapshot tests still pass an
  // `admin` prop, but those paths render WITHOUT a provider and fall
  // through the `useCommentsLeafContext` fallback below instead of
  // landing in `adapt`. So inside a compound usage we always read from
  // context — no more prop-vs-context drift surface.
  return {
    admin: ctx.admin,
    myCommentIds: ctx.myCommentIds,
    myCommentExpiresAt: ctx.myCommentExpiresAt,
    currentUserId: ctx.currentUserId,
    activeReplyToId: ctx.activeReplyToId,
    replyForm: ctx.replyForm,
    onReply: ctx.onReply,
    onEdited: ctx.onEdited,
    onApproved: ctx.onApproved,
    onDeleted: ctx.onDeleted,
    onDismissMyComment: ctx.onDismissMyComment,
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
// chain travels without `important`. The `comment-body` literal is a
// hook for `useFocusHash` which adds `.active` when the URL hash
// targets this comment (`#user-comment-<id>`) so the flash animation
// in `public.css` can replay.
const commentBodyClass = cn('comment-body', 'relative box-border flex max-w-full min-w-0 flex-1')

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
  // `editing` is a small state machine — only one kind of editor can be
  // open at a time. `admin` opens the admin/legacy-token-backed
  // `<CommentEditArea>` (which round-trips through `comment.getRaw` /
  // `comment.edit`); `own` opens the visitor-scoped `<OwnEditArea>`
  // (which posts to `comment.updateOwn` with the body the SSR already
  // shipped, no extra fetch). The footer picks the discriminator based
  // on which button the operator clicks.
  const [editing, setEditing] = useState<'admin' | 'own' | false>(false)
  const leaf = useCommentsLeafContext(propAdmin)
  const isMyComment = leaf.myCommentIds.has(asKey(comment.id))
  const isOwnedByCurrentUser = leaf.currentUserId !== null && String(comment.userId) === leaf.currentUserId
  const hasPendingDelete = comment.deleteRequestedAt !== null && comment.deleteRequestedAt !== undefined
  const isPending = pending ?? comment.isPending ?? false
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
                  backgroundColor: comment.badgeColor || 'var(--brand)',
                  color: comment.badgeTextColor || 'var(--canvas)',
                }}
              >
                {comment.badgeName}
              </span>
            )}
          </div>
          {isMyComment && (
            <div className="mt-1.5 mb-1.5 flex w-full items-center gap-1.5 rounded-md border border-amber-500/30 bg-status-warn-bg px-2.5 py-1 text-xs text-status-warn-fg">
              <span className="flex-1">{editableHint(leaf.myCommentExpiresAt.get(asKey(comment.id)), isPending)}</span>
              <button
                type="button"
                onClick={() => leaf.onDismissMyComment(comment.id)}
                className="inline-flex shrink-0 items-center justify-center rounded-sm p-0.5 hover:bg-status-warn-border"
                aria-label="关闭提示"
                title="关闭提示并移除编辑权限"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          )}
          {isOwnedByCurrentUser && hasPendingDelete && (
            <div className="mt-1.5 mb-1.5 flex w-full items-center gap-1.5 rounded-md border border-amber-500/30 bg-status-warn-bg px-2.5 py-1 text-xs text-status-warn-fg">
              <span className="flex-1">你已申请删除这条评论，等待管理员处理。</span>
            </div>
          )}
          {isPending && !isMyComment && (
            <div className={commentContentClass(depth)}>
              <div className="mt-1.5 mb-1.5 flex w-full items-center gap-1.5 rounded-md border border-amber-500/30 bg-status-warn-bg px-2.5 py-1 text-xs text-status-warn-fg">
                <span>您的评论正在等待审核中...</span>
              </div>
              <PortableTextBody body={comment.body} />
            </div>
          )}
          {(!isPending || isMyComment) && (
            <div className={commentContentClass(depth)}>
              <PortableTextBody body={comment.body} />
            </div>
          )}
          {editing === 'admin' && (
            <CommentEditArea
              commentId={comment.id}
              onCancel={() => setEditing(false)}
              onSaved={() => setEditing(false)}
            />
          )}
          {editing === 'own' && (
            <OwnEditArea comment={comment} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
          )}
          <CommentFooter
            comment={comment}
            admin={propAdmin}
            onEditAdmin={() => setEditing('admin')}
            onEditOwn={() => setEditing('own')}
          />
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
  /** Open the admin / legacy-token edit area (round-trips through `comment.edit`). */
  onEditAdmin: () => void
  /** Open the visitor self-edit area (posts to `comment.updateOwn`). */
  onEditOwn: () => void
}

function CommentFooter({ comment, admin: propAdmin, onEditAdmin, onEditOwn }: CommentFooterProps) {
  const siteIdentity = useSiteIdentity()
  const leaf = useCommentsLeafContext(propAdmin)
  const revalidator = useRevalidator()
  const approve = useApiFetcher<CommentRidInput, null>(API_ACTIONS.comment.approve, {
    onSuccess: () => leaf.onApproved(comment.id),
  })
  const remove = useApiFetcher<CommentRidInput, null>(API_ACTIONS.comment.delete, {
    onSuccess: () => leaf.onDeleted(comment.id),
  })

  // Visitor-scoped delete-request toggles. Both endpoints are POST + JSON
  // and take a plain `{ commentId }` payload, so `useApiFetcher` works
  // directly — no query-string round trip like `comment.updateOwn`.
  const requestDelete = useApiFetcher<{ commentId: string }, { success: boolean }>(
    API_ACTIONS.comment.requestDeleteOwn,
    {
      onSuccess: () => void revalidator.revalidate(),
    },
  )
  const cancelDelete = useApiFetcher<{ commentId: string }, { success: boolean }>(API_ACTIONS.comment.cancelDeleteOwn, {
    onSuccess: () => void revalidator.revalidate(),
  })

  const isOwnedByCurrentUser = leaf.currentUserId !== null && String(comment.userId) === leaf.currentUserId
  const hasPendingDelete = comment.deleteRequestedAt !== null && comment.deleteRequestedAt !== undefined
  // Admin already has the admin-edit affordance below; don't duplicate
  // the button for an admin who happens to also own the row.
  const showOwnAffordances = isOwnedByCurrentUser && !leaf.admin
  const ownEditDisabled = hasPendingDelete || requestDelete.isPending || cancelDelete.isPending
  const deleteToggleDisabled = requestDelete.isPending || cancelDelete.isPending

  const handleReply = () => leaf.onReply(Number(comment.id))
  const handleApprove = () => approve.submit({ rid: String(comment.id) })
  const handleDelete = () => remove.submit({ rid: String(comment.id) })
  const handleRequestDelete = () => requestDelete.submit({ commentId: String(comment.id) })
  const handleCancelDelete = () => cancelDelete.submit({ commentId: String(comment.id) })

  return (
    <div className="flex flex-1 items-center gap-2 text-xs text-ink-4">
      <time>{formatLocalDate(comment.createAt, 'yyyy-MM-dd HH:mm', siteIdentity)}</time>
      <button
        type="button"
        className={cn(commentFooterButtonClass, 'hover:text-brand')}
        data-rid={comment.id}
        // Keep the currently-focused reply/edit editor focused while the
        // click resolves. Without this, mousedown blurs the
        // contenteditable, `:focus-within` on the editor wrapper drops,
        // the toolbar collapses from `flex` to `hidden`, and the layout
        // shift between mousedown and mouseup makes the click miss the
        // button — the user has to click "回复" twice.
        onMouseDown={(event) => event.preventDefault()}
        onClick={handleReply}
      >
        回复
      </button>
      {(leaf.admin || leaf.myCommentIds.has(asKey(comment.id))) && (
        <button
          type="button"
          className={cn(commentFooterButtonClass, 'hover:text-alert')}
          data-rid={comment.id}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onEditAdmin}
        >
          编辑
        </button>
      )}
      {showOwnAffordances && !hasPendingDelete && (
        <button
          type="button"
          className={cn(commentFooterButtonClass, 'hover:text-alert')}
          data-rid={comment.id}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onEditOwn}
          disabled={ownEditDisabled}
        >
          修改
        </button>
      )}
      {showOwnAffordances &&
        (hasPendingDelete ? (
          <button
            type="button"
            className={cn(commentFooterButtonClass, 'hover:text-brand')}
            data-rid={comment.id}
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleCancelDelete}
            disabled={deleteToggleDisabled}
          >
            撤回删除
          </button>
        ) : (
          <button
            type="button"
            className={cn(commentFooterButtonClass, 'hover:text-alert')}
            data-rid={comment.id}
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleRequestDelete}
            disabled={deleteToggleDisabled}
          >
            申请删除
          </button>
        ))}
      {leaf.admin && (
        <>
          {comment.isPending && (
            <button
              type="button"
              className={cn(commentFooterButtonClass, 'text-warn')}
              data-rid={comment.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleApprove}
              disabled={approve.isPending}
            >
              通过
            </button>
          )}
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <button
                  type="button"
                  className={cn(commentFooterButtonClass, 'text-alert')}
                  data-rid={comment.id}
                  onMouseDown={(event) => event.preventDefault()}
                  disabled={remove.isPending}
                >
                  删除
                </button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除评论？</AlertDialogTitle>
                <AlertDialogDescription>此操作不可恢复，删除后评论将立即从前后台消失。</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
  const [body, setBody] = useState<CommentBody>(EMPTY_COMMENT_BODY)
  const [initialBody, setInitialBody] = useState<CommentBody>(EMPTY_COMMENT_BODY)
  const [bodyKey, setBodyKey] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const raw = useApiFetcher<never, CommentRawOutput>(API_ACTIONS.comment.getRaw, {
    onSuccess: (payload) => {
      const loadedBody = (payload.body ?? []) as CommentBody
      setInitialBody(loadedBody)
      setBody(loadedBody)
      setBodyKey((k) => k + 1)
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

  // Load the raw PT body on first mount.
  const rawLoad = raw.load
  useEffect(() => {
    rawLoad({ rid: String(commentId) })
  }, [commentId, rawLoad])

  const saving = editAction.isPending

  const handleSave = () => {
    if (isCommentBodyBlank(body)) {
      return
    }
    editAction.submit({ rid: String(commentId), body })
  }

  return (
    <div className="mt-2 block w-full">
      <CommentBodyEditor
        initialBody={initialBody}
        bodyKey={`edit-${commentId}-${bodyKey}`}
        onBodyChange={setBody}
        disabled={!loaded || saving}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button
          variant="default"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleSave}
          disabled={!loaded || saving}
        >
          {saving ? '保存中...' : '保存'}
        </Button>
        <Button variant="light" onMouseDown={(event) => event.preventDefault()} onClick={onCancel} disabled={saving}>
          取消
        </Button>
      </div>
    </div>
  )
}

// Visitor self-edit area. Differs from `<CommentEditArea>`:
// - posts to `comment.updateOwn` (visitor-allowed) instead of `comment.edit` (admin-only)
// - seeds the editor with `comment.body` directly — no extra `comment.getRaw`
//   round trip, mirroring `<MyEditCommentDialog>` in the admin panel
// - server enforces the 30-min auto-approve vs re-pend rule and may flip
//   the row back to pending; we let `useRevalidator()` re-fetch the loader
//   so the parent tree re-renders with the new state instead of guessing
//   client-side
const OWN_UPDATE_OWN = API_ACTIONS.comment.updateOwn

interface OwnEditAreaProps {
  comment: CommentItemType
  onCancel: () => void
  onSaved: () => void
}

function OwnEditArea({ comment, onCancel, onSaved }: OwnEditAreaProps) {
  const revalidator = useRevalidator()
  const fetcher = useFetcher<ApiEnvelope<{ success: boolean }>>()
  // `comment.body` is the full `PortableTextBody` dialect; the editor
  // expects the narrower `CommentBody`. Comment bodies are validated
  // against `commentBodySchema` at insert/update time, so the runtime
  // invariant holds (see the parallel cast in `MyEditCommentDialog`).
  const seed = comment.body as unknown as CommentBody
  const [body, setBody] = useState<CommentBody>(seed)
  const [bodyKey, setBodyKey] = useState(0)

  useFetcherResult(fetcher, {
    action: OWN_UPDATE_OWN,
    onSuccess: () => {
      void revalidator.revalidate()
      onSaved()
    },
  })

  const submitting = fetcher.state !== 'idle'

  const handleSave = () => {
    if (isCommentBodyBlank(body)) {
      return
    }
    // `updateOwn` reads `commentId` off the query string; the JSON body
    // carries the PortableText payload directly. Same shape as
    // `MyEditCommentDialog` so the server contract stays single-call-site.
    void fetcher.submit(body as never, {
      method: OWN_UPDATE_OWN.method,
      encType: 'application/json',
      action: `${OWN_UPDATE_OWN.path}?commentId=${encodeURIComponent(String(comment.id))}`,
    })
  }

  return (
    <div className="mt-2 block w-full">
      <CommentBodyEditor
        initialBody={seed}
        bodyKey={`own-edit-${comment.id}-${bodyKey}`}
        onBodyChange={(next) => {
          setBody(next)
          // Bump the key only on the first user edit so the editor
          // doesn't tear down mid-keystroke; this keeps the cancel/reopen
          // cycle clean without flicker.
          setBodyKey((k) => (k === 0 ? k + 1 : k))
        }}
        disabled={submitting}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button
          variant="default"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleSave}
          disabled={submitting}
        >
          {submitting ? '保存中...' : '保存'}
        </Button>
        <Button
          variant="light"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCancel}
          disabled={submitting}
        >
          取消
        </Button>
      </div>
    </div>
  )
}

function editableHint(expiresAt: number | undefined, isPending: boolean | undefined): string {
  if (expiresAt === undefined) {
    return isPending ? '此消息正在等待审核，可编辑。' : '可编辑此消息。'
  }
  const remainingMs = expiresAt - Date.now()
  if (remainingMs <= 0) {
    return isPending ? '此消息正在等待审核，编辑时间已过期。' : '编辑时间已过期。'
  }
  const remainingMinutes = Math.ceil(remainingMs / (60 * 1000))
  if (remainingMinutes >= 60) {
    const hours = Math.floor(remainingMinutes / 60)
    const mins = remainingMinutes % 60
    const timeStr = mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`
    return isPending ? `此消息正在等待审核，${timeStr}内可编辑。` : `${timeStr}内可编辑此消息。`
  }
  if (remainingMinutes <= 1) {
    const seconds = Math.ceil(remainingMs / 1000)
    return isPending ? `此消息正在等待审核，${seconds} 秒内可编辑。` : `${seconds} 秒内可编辑此消息。`
  }
  return isPending
    ? `此消息正在等待审核，${remainingMinutes} 分钟内可编辑。`
    : `${remainingMinutes} 分钟内可编辑此消息。`
}
