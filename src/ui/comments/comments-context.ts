import { createContext, useContext } from 'react'

import type { CommentFormUser } from '@/server/catalog'
import type { CommentItem as CommentItemType } from '@/server/comments/types'

// Public-detail comments island state, lifted into a Context so the recursive
// `<CommentItem>` tree no longer threads `actions={…}` / `replyForm` /
// `replyToId` through every level via render-prop callbacks.
//
// The reducer / `createCommentTreeState` factory live in `Comments.tsx`
// alongside the orchestrator that owns them; this module ships only the
// types and the consumer hook, so leaf components don't import the reducer.

export interface CommentTreeState {
  items: CommentItemType[]
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
  | { type: 'insertReply'; comment: CommentItemType; rid: number }
  | { type: 'updateComment'; comment: CommentItemType }
  | { type: 'removeComment'; id: bigint | string }
  | { type: 'approveComment'; id: bigint | string }
  | { type: 'setReplyTo'; rid: number }

export interface CommentsContextValue {
  commentKey: string
  totalCount: number
  /** Pre-resolved admin flag so leaf components don't re-derive it. */
  admin: boolean
  user?: CommentFormUser
  state: CommentTreeState
  /** Reply target id resolved against the visible tree, or `0` when none. */
  activeReplyToId: number
  /** Actions surfaced to leaf components (no render-prop drilling). */
  onReply: (rid: number) => void
  onCancelReply: () => void
  onEdited: (comment: CommentItemType) => void
  onApproved: (id: bigint | string) => void
  onDeleted: (id: bigint | string) => void
  /** Forwarded so `<Comments.LoadMore>` can append to the visible tree. */
  dispatch: React.Dispatch<CommentTreeAction>
  /** The reply form node, rendered inline at the active reply target. */
  replyForm: React.ReactNode
}

export const CommentsContext = createContext<CommentsContextValue | null>(null)

export function useCommentsContext(component: string): CommentsContextValue {
  const ctx = useContext(CommentsContext)
  if (ctx === null) {
    throw new Error(`<${component}> must be rendered inside <Comments>`)
  }
  return ctx
}
