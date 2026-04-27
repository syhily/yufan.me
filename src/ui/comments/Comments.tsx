import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import type { CommentFormUser } from '@/server/catalog'
import type { CommentItem as CommentItemType, Comments as CommentsData } from '@/server/comments/types'

import { useIosNoZoomOnFocus } from '@/client/hooks/use-ios-no-zoom'
import { CommentReplyForm } from '@/ui/comments/CommentReplyForm'
import {
  CommentsActionsContext,
  type CommentsActionsContextValue,
  CommentsMetaContext,
  type CommentsMetaContextValue,
  CommentsReplyFormContext,
  CommentsStateContext,
} from '@/ui/comments/comments-context'
import { CommentsLoadMore } from '@/ui/comments/Comments.LoadMore'
import { CommentsHeader, CommentsList, CommentsReplyFormSlot } from '@/ui/comments/Comments.parts'
import { commentTreeReducer, createCommentTreeState, nodeToCommentItem } from '@/ui/comments/Comments.reducer'

export interface CommentsProps {
  commentKey: string
  comments: CommentsData | null
  items: CommentItemType[]
  user?: CommentFormUser
}

// Public entry. Validates the loader payload and otherwise delegates to the
// orchestrator (`CommentsRoot`) + compound subcomponents
// (`Comments.Header`, `Comments.ReplyFormSlot`, `Comments.List`,
// `Comments.LoadMore`). Leaf components consume the shared
// `CommentsContext` instead of accepting render-prop callbacks.
export function Comments({ commentKey, comments, items, user }: CommentsProps) {
  if (comments == null) {
    return (
      <div id="comments" className="pt-5">
        评论加载失败 ❌
      </div>
    )
  }

  return (
    <CommentsRoot
      key={commentKey}
      commentKey={commentKey}
      initialItems={items}
      rootsCount={comments.roots_count}
      totalCount={comments.count}
      user={user}
    >
      <Comments.Header />
      <Comments.ReplyFormSlot />
      <Comments.List />
      <Comments.LoadMore />
    </CommentsRoot>
  )
}

interface CommentsRootProps {
  commentKey: string
  initialItems: CommentItemType[]
  rootsCount: number
  totalCount: number
  user?: CommentFormUser
  children: React.ReactNode
}

function asKey(value: bigint | string | number): string {
  return String(value)
}

function CommentsRoot({ commentKey, initialItems, rootsCount, totalCount, user, children }: CommentsRootProps) {
  const [state, dispatch] = useReducer(commentTreeReducer, createCommentTreeState(initialItems, rootsCount))

  // Suppress iOS Safari's auto-zoom while any comment input/textarea is
  // focused, then restore the original viewport meta on blur.
  const containerRef = useRef<HTMLDivElement | null>(null)
  useIosNoZoomOnFocus(containerRef)

  // Focus the reply form's textarea after a Reply click. The form is
  // rendered through React, so we thread a ref into `<CommentReplyForm>`
  // and let it expose the node.
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Track whether the next `state.replyToId` change comes from a user
  // click (Reply / Cancel) vs an external trigger. The effect below
  // only scrolls the textarea into view when the flag is set, so it
  // never fights `useFocusHash` when the URL already targets a
  // `#user-comment-NN` anchor and a future feature deep-links into a
  // reply form via a non-user-initiated dispatch (today the reducer
  // only sees `setReplyTo` from the click handlers below — the guard
  // is defensive for that future).
  const userInitiatedRef = useRef(false)

  const onReply = useCallback((rid: number) => {
    userInitiatedRef.current = true
    dispatch({ type: 'setReplyTo', rid })
  }, [])
  const onCancelReply = useCallback(() => {
    userInitiatedRef.current = true
    dispatch({ type: 'setReplyTo', rid: 0 })
  }, [])
  const onEdited = useCallback((comment: CommentItemType) => dispatch({ type: 'updateComment', comment }), [])
  const onApproved = useCallback((id: bigint | string) => dispatch({ type: 'approveComment', id }), [])
  const onDeleted = useCallback((id: bigint | string) => dispatch({ type: 'removeComment', id }), [])
  const onReplied = useCallback((comment: CommentItemType, rid: number) => {
    dispatch({ type: 'insertReply', comment, rid })
    userInitiatedRef.current = true
    dispatch({ type: 'setReplyTo', rid: 0 })
  }, [])

  // Drive textarea focus from `state.replyToId` instead of `flushSync`-ing the
  // dispatch. React 19's automatic batching survives, and the focus call
  // happens after the new tree commits.
  useEffect(() => {
    if (state.replyToId === 0 || !userInitiatedRef.current) {
      userInitiatedRef.current = false
      return
    }
    userInitiatedRef.current = false
    const textarea = replyTextareaRef.current
    textarea?.focus({ preventScroll: true })
    textarea?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [state.replyToId])

  const admin = user?.admin === true
  const replyTargetNode = state.replyToId === 0 ? undefined : state.byId.get(asKey(state.replyToId))
  const replyTarget = replyTargetNode === undefined ? undefined : nodeToCommentItem(replyTargetNode)
  const activeReplyToId = replyTarget ? state.replyToId : 0

  const meta: CommentsMetaContextValue = useMemo(
    () => ({ commentKey, totalCount, admin, user }),
    [commentKey, totalCount, admin, user],
  )

  const actions: CommentsActionsContextValue = useMemo(
    () => ({ onReply, onCancelReply, onEdited, onApproved, onDeleted, dispatch }),
    [onReply, onCancelReply, onEdited, onApproved, onDeleted],
  )

  // The same reply form JSX flows through context to whichever depth
  // currently owns it (top-level or nested under the active comment).
  // Living on its own context means a fresh JSX identity only invalidates
  // the active reply row plus `<Comments.ReplyFormSlot>` — every other
  // memoised `<CommentItem>` skips reconciliation.
  const replyForm = (
    <CommentReplyForm
      commentKey={commentKey}
      replyToId={activeReplyToId}
      replyTarget={replyTarget}
      user={user}
      onCancel={onCancelReply}
      onReplied={onReplied}
      textareaRef={replyTextareaRef}
    />
  )

  return (
    <CommentsMetaContext.Provider value={meta}>
      <CommentsActionsContext.Provider value={actions}>
        <CommentsStateContext.Provider value={state}>
          <CommentsReplyFormContext.Provider value={replyForm}>
            <div id="comments" className="pt-5" ref={containerRef}>
              {children}
            </div>
          </CommentsReplyFormContext.Provider>
        </CommentsStateContext.Provider>
      </CommentsActionsContext.Provider>
    </CommentsMetaContext.Provider>
  )
}

Comments.Header = CommentsHeader
Comments.ReplyFormSlot = CommentsReplyFormSlot
Comments.List = CommentsList
Comments.LoadMore = CommentsLoadMore

// Re-export the reducer + factory so the `tests/component.public-state-reset`
// suite (and any future external consumer) can keep importing them by name.
export { commentTreeReducer, createCommentTreeState }
export type { CommentTreeAction, CommentTreeState } from '@/ui/comments/comments-context'
