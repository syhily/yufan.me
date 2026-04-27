import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  memo,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useFormStatus } from 'react-dom'

import type { CommentEditInput, CommentEditOutput, CommentRawOutput, CommentRidInput } from '@/client/api/action-types'
import type { CommentItem as CommentItemType } from '@/server/comments/types'

import { API_ACTIONS } from '@/client/api/actions'
import { useApiAction } from '@/client/api/fetcher'
import { formatLocalDate } from '@/shared/formatter'
import { safeHref } from '@/shared/safe-url'
import { joinUrl } from '@/shared/urls'
import { CommentBody } from '@/ui/comments/CommentBody'
import {
  type CommentNode,
  CommentsMetaContext,
  useCommentNode,
  useCommentsActions,
  useReplyFormForId,
} from '@/ui/comments/comments-context'
import { cn } from '@/ui/lib/cn'
import { badgeVariants } from '@/ui/primitives/Badge'
import { Button } from '@/ui/primitives/Button'
import { Textarea } from '@/ui/primitives/Textarea'

export interface CommentItemProps {
  depth: number
  /**
   * Normalised node id. Provided by the `<Comments>` orchestrator so leaf
   * rows look themselves up via context (`useCommentNode(id)`), which is
   * what lets `React.memo` skip unrelated dispatches. Standalone callers
   * — `<Comment>` SSR helper and snapshot tests — pass `comment` instead.
   */
  id?: string
  comment?: CommentItemType
  /** Renders the "等待审核" hint over the body. Falls back to `comment.isPending`. */
  pending?: boolean
  /**
   * Standalone admin override. When `<CommentItem>` is rendered outside the
   * `<Comments>` orchestrator (e.g. SSR snapshot tests), callers pass this
   * directly; in compound usage the value lifts from context.
   */
  admin?: boolean
}

interface ResolvedNode {
  /** Stable id used for child recursion / `React.memo` keys. */
  id: string
  /** Comment data (without the legacy nested `children` array). */
  data: Omit<CommentItemType, 'children'>
  /** Child ids when the node was resolved via the orchestrator. */
  childrenIds: string[] | null
  /** Inline children when the node was resolved from the `comment` prop. */
  inlineChildren: CommentItemType[] | null
}

// Resolve a `<CommentItem>` to the row data + child shape it should render.
//
// - When `id` is provided AND a `<Comments>` provider is mounted, we read
//   the row out of the normalised store. Children recurse by id.
// - Otherwise we fall back to the `comment` prop. Children recurse by
//   inline `children: CommentItemType[]`. This keeps the standalone
//   `<Comment>` SSR helper and the snapshot tests working unchanged.
function useResolvedNode(props: CommentItemProps): ResolvedNode | null {
  const node = useCommentNode(props.id ?? '')
  if (props.id !== undefined && node !== null) {
    return {
      id: props.id,
      data: stripChildrenIds(node),
      childrenIds: node.childrenIds,
      inlineChildren: null,
    }
  }
  if (props.comment !== undefined) {
    return {
      id: asKey(props.comment.id),
      data: props.comment,
      childrenIds: null,
      inlineChildren: props.comment.children ?? [],
    }
  }
  return null
}

function stripChildrenIds(node: CommentNode): Omit<CommentItemType, 'children'> {
  const { childrenIds: _childrenIds, ...rest } = node
  return rest
}

/**
 * Reads only Meta + Actions from the orchestrator. The recursive
 * `<CommentItem>` no longer subscribes to the reply-form context here,
 * so a fresh reply-form JSX node leaves the visible tree untouched.
 * Standalone callers (no orchestrator) get a no-op fallback through
 * `useCommentsActions()`.
 */
function useCommentsLeafContext(propAdmin: boolean | undefined): {
  admin: boolean
  onReply: (rid: number) => void
  onEdited: (comment: CommentItemType) => void
  onApproved: (id: bigint | string) => void
  onDeleted: (id: bigint | string) => void
} {
  const meta = useContext(CommentsMetaContext)
  const actions = useCommentsActions()
  const admin = propAdmin === undefined ? meta?.admin === true : propAdmin
  return {
    admin,
    onReply: actions.onReply,
    onEdited: actions.onEdited,
    onApproved: actions.onApproved,
    onDeleted: actions.onDeleted,
  }
}

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
//
// Memoised so a dispatch that touches a deeply-nested comment only
// re-renders the affected branch — root rows whose `id` and `depth` stay
// the same skip work entirely.
export const CommentItem = memo(function CommentItem(props: CommentItemProps) {
  const resolved = useResolvedNode(props)
  if (resolved === null) {
    return null
  }
  return props.depth === 1 ? (
    <RootComment {...props} resolved={resolved} />
  ) : (
    <NestedComment {...props} resolved={resolved} />
  )
})

interface ResolvedItemProps extends CommentItemProps {
  resolved: ResolvedNode
}

function RootComment({ resolved, depth, pending, admin: propAdmin }: ResolvedItemProps) {
  // Reads the reply-form context only — and only forwards the node when
  // *this* row is the active reply target. Other rows skip the
  // subscription and stay memoised across reply-form identity churn.
  const replyFormForRow = useReplyFormForId(resolved.id)
  const childrenTail = depth === 1 ? replyFormForRow : null
  const childCount = resolved.childrenIds?.length ?? resolved.inlineChildren?.length ?? 0
  const showChildrenList = childCount > 0 || childrenTail !== null
  return (
    <CommentLi data={resolved.data} depth={depth} pending={pending} admin={propAdmin}>
      {showChildrenList && (
        <ul data-nested className="text-sm p-4 mt-4 ml-[2.375rem] rounded-sm bg-surface-muted md:p-6 md:mt-5 md:ml-14">
          <ChildList resolved={resolved} depth={depth + 1} admin={propAdmin} />
          {childrenTail && <li>{childrenTail}</li>}
        </ul>
      )}
    </CommentLi>
  )
}

function NestedComment({ resolved, depth, pending, admin: propAdmin }: ResolvedItemProps) {
  const replyFormForRow = useReplyFormForId(resolved.id)
  const afterComment = depth !== 1 ? replyFormForRow : null
  return (
    <>
      <CommentLi data={resolved.data} depth={depth} pending={pending} admin={propAdmin} />
      {afterComment && <li>{afterComment}</li>}
      <ChildList resolved={resolved} depth={depth + 1} admin={propAdmin} />
    </>
  )
}

interface ChildListProps {
  resolved: ResolvedNode
  depth: number
  admin: boolean | undefined
}

function ChildList({ resolved, depth, admin }: ChildListProps) {
  if (resolved.childrenIds !== null) {
    return (
      <>
        {resolved.childrenIds.map((childId) => (
          <CommentItem key={childId} id={childId} depth={depth} admin={admin} />
        ))}
      </>
    )
  }
  if (resolved.inlineChildren !== null) {
    return (
      <>
        {resolved.inlineChildren.map((child) => (
          <CommentItem key={asKey(child.id)} comment={child} depth={depth} admin={admin} />
        ))}
      </>
    )
  }
  return null
}

interface CommentLiProps {
  data: Omit<CommentItemType, 'children'>
  depth: number
  pending: boolean | undefined
  admin: boolean | undefined
  children?: React.ReactNode
}

function CommentLi({ data: comment, depth, pending, admin: propAdmin, children }: CommentLiProps) {
  const authorHref = safeHref(comment.link)
  const [editing, setEditing] = useState(false)
  return (
    <li
      id={`user-comment-${comment.id}`}
      className="relative mb-4 pb-4 border-b border-border last:m-0 last:p-0 last:border-b-0 md:mb-6 md:pb-6"
      data-depth={depth}
    >
      <article id={`div-comment-${comment.id}`} className="relative flex flex-auto min-w-0 max-w-full box-border">
        <div
          className="flex-avatar w-7 h-7 mr-2.5 md:w-10 md:h-10 md:mr-[0.9375rem]"
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
        <div className="author-row flex-auto min-w-0 mt-0.5 md:mt-0">
          <div className="font-bold inline-flex flex-wrap items-center gap-1.5 max-w-full [&_a]:align-middle">
            {authorHref === undefined ? (
              comment.name
            ) : (
              <a href={authorHref} rel="nofollow noreferrer" target="_blank">
                {comment.name}
              </a>
            )}
            {comment.badgeName && (
              // The comment-author badge is intentionally tone-less: its
              // bg / fg are driven by per-comment CSS variables
              // (`--badge-color`, `--badge-fg`) that come straight from the
              // database, not from the project palette. We reach for
              // `badgeVariants()` only to inherit the layout (font + spacing)
              // — colour stays under the inline-style override below.
              <span
                className={cn(
                  badgeVariants(),
                  'inline-flex flex-none items-center px-1.5 py-0.5 leading-[1.2] whitespace-nowrap rounded-full font-bold border-0 bg-[color:var(--badge-color)] text-[color:var(--badge-fg)]',
                )}
                style={badgeStyle(comment.badgeColor, comment.badgeTextColor)}
              >
                {comment.badgeName}
              </span>
            )}
          </div>
          <div className="comment-body prose-host whitespace-normal break-words my-2 leading-[1.85]">
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
  comment: Omit<CommentItemType, 'children'>
  admin: boolean | undefined
  onEdit: () => void
}

function CommentFooter({ comment, admin: propAdmin, onEdit }: CommentFooterProps) {
  const leaf = useCommentsLeafContext(propAdmin)
  const approve = useApiAction<CommentRidInput, null>(API_ACTIONS.comment.approve, {
    onSuccess: () => leaf.onApproved(comment.id),
  })
  const remove = useApiAction<CommentRidInput, null>(API_ACTIONS.comment.delete, {
    onSuccess: () => leaf.onDeleted(comment.id),
  })

  const handleReply = () => leaf.onReply(Number(comment.id))

  // React 19 `<form action={fn}>` lets the moderation buttons drive their own
  // submission lifecycle through `useFormStatus`, so each button gets a free
  // `pending` flag for `disabled` without us threading `approve.isPending` /
  // `remove.isPending` through render.
  const approveAction = async () => {
    await approve.submit({ rid: String(comment.id) })
  }
  const removeAction = async () => {
    await remove.submit({ rid: String(comment.id) })
  }

  return (
    <div className="text-xs text-foreground-muted flex flex-auto items-center [&_button]:bg-transparent [&_button]:transition-all [&_button]:duration-300 [&_button]:ease-linear">
      <time className="comment-time me-2 flex-auto">{formatLocalDate(comment.createAt, 'yyyy-MM-dd HH:mm')}</time>
      <button type="button" className="me-2 hover:text-accent" data-rid={comment.id} onClick={handleReply}>
        回复
      </button>
      {leaf.admin && (
        <>
          <button type="button" className="me-2 hover:text-danger" data-rid={comment.id} onClick={onEdit}>
            编辑
          </button>
          {comment.isPending && (
            <ModerateForm action={approveAction}>
              <ModerateSubmit className="me-2 text-warning" data-rid={comment.id}>
                通过
              </ModerateSubmit>
            </ModerateForm>
          )}
          <DeleteButton commentId={comment.id} onConfirmed={removeAction} />
        </>
      )}
    </div>
  )
}

// Two-step delete affordance that replaces a `window.confirm()` modal with an
// inline cancel/confirm pair. Following
// `vercel-composition-patterns/state-prefer-progressive-disclosure`, the
// armed state lives in this leaf so the rest of the comment row stays calm.
//
// While confirming, both buttons live inside the same `<form action>` so
// `useFormStatus` covers the submit *and* the cancel — preventing the
// "user cancels mid-submit but the API still resolves and the comment
// vanishes" race that an outside-form cancel button would have.
//
// Auto-focus on cancel keeps the safer default reachable with a single
// Enter, matches the native `confirm()` dialog's bias, and gives keyboard
// users a focus indicator that survives the inline replacement of the
// armed-state buttons. Esc collapses back to the unarmed view so the
// destructive flow has a no-mouse escape hatch.
function DeleteButton({ commentId, onConfirmed }: { commentId: bigint | string; onConfirmed: () => Promise<void> }) {
  const [armed, setArmed] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (armed) {
      cancelRef.current?.focus()
    }
  }, [armed])

  if (!armed) {
    return (
      <button type="button" className="me-2 hover:text-danger" data-rid={commentId} onClick={() => setArmed(true)}>
        删除
      </button>
    )
  }

  return (
    <form
      action={onConfirmed}
      className="me-2 inline-flex items-center gap-1"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          setArmed(false)
        }
      }}
    >
      <DeleteCancelButton cancelRef={cancelRef} onCancel={() => setArmed(false)} />
      <ModerateSubmit className="text-danger" data-rid={commentId}>
        确认删除
      </ModerateSubmit>
    </form>
  )
}

interface DeleteCancelButtonProps {
  cancelRef: RefObject<HTMLButtonElement | null>
  onCancel: () => void
}

function DeleteCancelButton({ cancelRef, onCancel }: DeleteCancelButtonProps) {
  const status = useFormStatus()
  return (
    <button
      ref={cancelRef}
      type="button"
      onClick={onCancel}
      disabled={status.pending}
      className="text-foreground-muted hover:text-foreground"
    >
      取消
    </button>
  )
}

// Wraps a single moderation button in its own `<form action={fn}>` so the
// submit lifecycle is owned by the platform: React 19 unwinds the pending
// state automatically and `<ModerateSubmit>` reads it through `useFormStatus`
// without prop-drilling.
function ModerateForm({ action, children }: { action: () => Promise<void> | void; children: ReactNode }) {
  return (
    <form action={action} className="contents">
      {children}
    </form>
  )
}

interface ModerateSubmitProps {
  className: string
  'data-rid': bigint | string
  children: ReactNode
}

function ModerateSubmit({ className, 'data-rid': dataRid, children }: ModerateSubmitProps) {
  const status = useFormStatus()
  return (
    <button type="submit" className={className} data-rid={dataRid} disabled={status.pending}>
      {children}
    </button>
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

  const raw = useApiAction<never, CommentRawOutput>(API_ACTIONS.comment.getRaw, {
    onSuccess: (payload) => {
      setValue(payload.content || '')
      setLoaded(true)
    },
  })
  const editAction = useApiAction<CommentEditInput, CommentEditOutput>(API_ACTIONS.comment.edit, {
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
    void rawLoad({ rid: String(commentId) })
  }, [commentId, rawLoad])

  const saving = editAction.isPending

  const handleSave = () => {
    if (!value.trim()) {
      return
    }
    void editAction.submit({ rid: String(commentId), content: value })
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
