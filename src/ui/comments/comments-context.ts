import { createContext, type Dispatch, type ReactNode, useContext } from 'react'

import type { CommentFormUser } from '@/server/catalog'
import type { CommentItem as CommentItemType } from '@/server/comments/types'

// Public-detail comments island state, lifted into Contexts so the recursive
// `<CommentItem>` tree no longer threads `actions={…}` / `replyForm` /
// `replyToId` through every level via render-prop callbacks.
//
// The context is intentionally split into four narrow providers — Meta,
// Actions, State, ReplyForm — so a fresh `replyForm` JSX node no longer
// invalidates every consumer of the orchestrator. Only the row whose
// `data-nested` slot is active re-reads the form node; every other
// `<CommentItem>` skips render entirely thanks to its existing
// `React.memo`. See `vercel-composition-patterns/context-split-providers`.
//
// The reducer / `createCommentTreeState` factory live in `Comments.tsx`
// alongside the orchestrator that owns them; this module ships only the
// types and the consumer hooks, so leaf components don't import the reducer.

/**
 * A single normalised comment row. The list of immediate replies is
 * stored as `childrenIds`; the corresponding comment objects live in
 * `byId` on the parent state. Storing per-row data in a `Map` instead of
 * a nested tree means a `dispatch` that touches a deeply-nested comment
 * only invalidates that comment's identity — the parent rows stay
 * referentially equal, which is exactly what `React.memo(CommentItem)`
 * needs to skip re-rendering unchanged branches.
 */
export interface CommentNode extends Omit<CommentItemType, 'children'> {
  childrenIds: string[]
}

export interface CommentTreeState {
  /** Per-id row data + child id list. Keys are stringified `comment.id`. */
  byId: Map<string, CommentNode>
  /** Top-level comment ids in render order. */
  roots: string[]
  /** Currently visible "root" count for "load more" pagination. */
  rootsLoaded: number
  /** Total root comments according to the latest server response. */
  rootsTotal: number
  /** Currently active reply target id, or 0 when replying to the root. */
  replyToId: number
}

export type CommentTreeAction =
  | { type: 'reset'; items: CommentItemType[]; rootsTotal: number; rootsLoaded: number }
  | { type: 'append'; items: CommentItemType[]; rootsLoaded: number }
  /**
   * Append a single root subtree as it streams in from the NDJSON
   * variant of `comment.loadComments`. Increments `rootsLoaded` by one
   * so the "load more" button hides as soon as the cursor exhausts.
   */
  | { type: 'appendOne'; comment: CommentItemType }
  /** Update the total root count (emitted on the streaming `meta` line). */
  | { type: 'setRootsTotal'; rootsTotal: number }
  | { type: 'insertReply'; comment: CommentItemType; rid: number }
  | { type: 'updateComment'; comment: CommentItemType }
  | { type: 'removeComment'; id: bigint | string }
  | { type: 'approveComment'; id: bigint | string }
  | { type: 'setReplyTo'; rid: number }

/**
 * Stable per-island metadata. Identity is locked to `commentKey` /
 * `totalCount` / `admin` / `user`, so consumers that only read the
 * meta block skip re-renders triggered by reducer dispatches and
 * reply-form JSX churn.
 */
export interface CommentsMetaContextValue {
  commentKey: string
  totalCount: number
  admin: boolean
  user?: CommentFormUser
}

/**
 * Stable callbacks. Each function is wrapped in `useCallback` by the
 * orchestrator so the bag identity survives state updates. Leaf
 * components (`CommentItem`, `LoadMore`) read this without subscribing
 * to per-row mutations.
 */
export interface CommentsActionsContextValue {
  onReply: (rid: number) => void
  onCancelReply: () => void
  onEdited: (comment: CommentItemType) => void
  onApproved: (id: bigint | string) => void
  onDeleted: (id: bigint | string) => void
  /** Forwarded so `<Comments.LoadMore>` can append to the visible tree. */
  dispatch: Dispatch<CommentTreeAction>
}

export const CommentsMetaContext = createContext<CommentsMetaContextValue | null>(null)
export const CommentsActionsContext = createContext<CommentsActionsContextValue | null>(null)
export const CommentsStateContext = createContext<CommentTreeState | null>(null)
export const CommentsReplyFormContext = createContext<ReactNode>(null)

const NOOP_ACTIONS: CommentsActionsContextValue = {
  onReply: () => {},
  onCancelReply: () => {},
  onEdited: () => {},
  onApproved: () => {},
  onDeleted: () => {},
  dispatch: () => {},
}

export function useCommentsMeta(component: string): CommentsMetaContextValue {
  const ctx = useContext(CommentsMetaContext)
  if (ctx === null) {
    throw new Error(`<${component}> must be rendered inside <Comments>`)
  }
  return ctx
}

export function useCommentsActions(): CommentsActionsContextValue {
  return useContext(CommentsActionsContext) ?? NOOP_ACTIONS
}

export function useCommentsState(): CommentTreeState | null {
  return useContext(CommentsStateContext)
}

/**
 * Read a single comment row from the orchestrator. Returns `null` when
 * `<CommentItem>` is rendered outside a `<Comments>` provider — in that
 * case the caller falls back to the `comment` prop instead.
 */
export function useCommentNode(id: string): CommentNode | null {
  const state = useContext(CommentsStateContext)
  if (state === null) {
    return null
  }
  return state.byId.get(id) ?? null
}

/**
 * Returns the reply-form JSX node IFF the requested id is the active
 * reply target. Other rows read `null` and skip the subscription, so
 * a fresh reply-form identity invalidates only the active row.
 */
export function useReplyFormForId(id: string | null): ReactNode {
  const state = useContext(CommentsStateContext)
  const replyForm = useContext(CommentsReplyFormContext)
  if (id === null || state === null || state.replyToId === 0) {
    return null
  }
  return String(state.replyToId) === id ? replyForm : null
}

/**
 * Returns the active reply target id (or `0` when no reply is active).
 * Reads only the state context.
 */
export function useActiveReplyToId(): number {
  const state = useContext(CommentsStateContext)
  return state?.replyToId ?? 0
}

/**
 * Convenience: the reply form node when it's anchored at the root
 * (i.e. no comment is the active reply target). Used by
 * `<Comments.ReplyFormSlot>` to render the top-level form.
 */
export function useRootReplyForm(): ReactNode {
  const state = useContext(CommentsStateContext)
  const replyForm = useContext(CommentsReplyFormContext)
  if (state === null || state.replyToId !== 0) {
    return null
  }
  return replyForm
}
