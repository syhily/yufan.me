import { useCallback, useReducer, useRef } from 'react'
import { flushSync } from 'react-dom'

import type { LoadCommentsInput, LoadCommentsOutput } from '@/client/api/action-types'
import type { CommentFormUser } from '@/server/catalog'
import type { CommentItem as CommentItemType, Comments as CommentsData } from '@/server/comments/types'

import config from '@/blog.config'
import { API_ACTIONS } from '@/client/api/actions'
import { useApiFetcher } from '@/client/api/fetcher'
import { useIosNoZoomOnFocus } from '@/client/hooks/use-ios-no-zoom'
import { CommentItem } from '@/ui/comments/CommentItem'
import { CommentReplyForm } from '@/ui/comments/CommentReplyForm'
import {
  CommentsContext,
  type CommentsContextValue,
  type CommentTreeAction,
  type CommentTreeState,
  useCommentsContext,
} from '@/ui/comments/comments-context'
import { Button } from '@/ui/primitives/Button'

export interface CommentsProps {
  commentKey: string
  comments: CommentsData | null
  items: CommentItemType[]
  user?: CommentFormUser
}

function asKey(value: bigint | string | number): string {
  return String(value)
}

// Replace a comment by id anywhere in the tree (root or nested).
function mapTree(items: CommentItemType[], fn: (item: CommentItemType) => CommentItemType): CommentItemType[] {
  return items.map((item) => {
    const next = fn(item)
    if (next.children && next.children.length > 0) {
      const children = mapTree(next.children, fn)
      return children === next.children ? next : { ...next, children }
    }
    return next
  })
}

function filterTree(items: CommentItemType[], predicate: (item: CommentItemType) => boolean): CommentItemType[] {
  return items.filter(predicate).map((item) => {
    if (item.children && item.children.length > 0) {
      return { ...item, children: filterTree(item.children, predicate) }
    }
    return item
  })
}

function reducer(state: CommentTreeState, action: CommentTreeAction): CommentTreeState {
  switch (action.type) {
    case 'reset':
      return {
        items: action.items,
        rootsTotal: action.rootsTotal,
        rootsLoaded: action.rootsLoaded,
        replyToId: 0,
      }
    case 'append':
      return {
        ...state,
        items: [...state.items, ...action.items],
        rootsLoaded: action.rootsLoaded,
      }
    case 'insertReply': {
      if (action.rid === 0) {
        return {
          ...state,
          items: [action.comment, ...state.items],
          rootsTotal: state.rootsTotal + 1,
          rootsLoaded: state.rootsLoaded + 1,
        }
      }
      const ridKey = asKey(action.rid)
      const items = mapTree(state.items, (item) => {
        if (asKey(item.id) !== ridKey) return item
        const children = item.children ?? []
        return { ...item, children: [...children, action.comment] }
      })
      return { ...state, items }
    }
    case 'updateComment': {
      const id = asKey(action.comment.id)
      const items = mapTree(state.items, (item) => {
        if (asKey(item.id) !== id) return item
        // Preserve existing children (the edit endpoint returns the comment
        // shape without its descendants).
        const children = item.children
        return { ...action.comment, children }
      })
      return { ...state, items }
    }
    case 'removeComment': {
      const id = asKey(action.id)
      const items = filterTree(state.items, (item) => asKey(item.id) !== id)
      return { ...state, items }
    }
    case 'approveComment': {
      const id = asKey(action.id)
      const items = mapTree(state.items, (item) => {
        if (asKey(item.id) !== id) return item
        return { ...item, isPending: false }
      })
      return { ...state, items }
    }
    case 'setReplyTo':
      return { ...state, replyToId: action.rid }
  }
}

export function createCommentTreeState(items: CommentItemType[], rootsCount: number): CommentTreeState {
  return {
    items,
    rootsLoaded: Math.min(items.length, rootsCount),
    rootsTotal: rootsCount,
    replyToId: 0,
  }
}

export const commentTreeReducer = reducer

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

function CommentsRoot({ commentKey, initialItems, rootsCount, totalCount, user, children }: CommentsRootProps) {
  const [state, dispatch] = useReducer(reducer, createCommentTreeState(initialItems, rootsCount))

  // Suppress iOS Safari's auto-zoom while any comment input/textarea is
  // focused, then restore the original viewport meta on blur.
  const containerRef = useRef<HTMLDivElement | null>(null)
  useIosNoZoomOnFocus(containerRef)

  // Focus the reply form's textarea after a Reply click. The form is
  // rendered through React, so we thread a ref into `<CommentReplyForm>`
  // and let it expose the node.
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const focusReplyForm = useCallback(() => {
    const textarea = replyTextareaRef.current
    textarea?.focus({ preventScroll: true })
    textarea?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const onReply = useCallback(
    (rid: number) => {
      flushSync(() => {
        dispatch({ type: 'setReplyTo', rid })
      })
      focusReplyForm()
    },
    [focusReplyForm],
  )
  const onCancelReply = useCallback(() => dispatch({ type: 'setReplyTo', rid: 0 }), [])
  const onEdited = useCallback((comment: CommentItemType) => dispatch({ type: 'updateComment', comment }), [])
  const onApproved = useCallback((id: bigint | string) => dispatch({ type: 'approveComment', id }), [])
  const onDeleted = useCallback((id: bigint | string) => dispatch({ type: 'removeComment', id }), [])
  const onReplied = useCallback((comment: CommentItemType, rid: number) => {
    dispatch({ type: 'insertReply', comment, rid })
    dispatch({ type: 'setReplyTo', rid: 0 })
  }, [])

  const admin = user?.admin === true
  const replyTarget = state.replyToId === 0 ? undefined : findComment(state.items, state.replyToId)
  const activeReplyToId = replyTarget ? state.replyToId : 0

  // The same reply form JSX flows through context to whichever depth
  // currently owns it (top-level or nested under the active comment).
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

  // Rebuilt every render because `replyForm` is a fresh JSX node each time;
  // memoising would force an extra dependency without a re-render benefit
  // (every consumer re-renders on `state` changes anyway).
  const value: CommentsContextValue = {
    commentKey,
    totalCount,
    admin,
    user,
    state,
    activeReplyToId,
    onReply,
    onCancelReply,
    onEdited,
    onApproved,
    onDeleted,
    dispatch,
    replyForm,
  }

  return (
    <CommentsContext.Provider value={value}>
      <div id="comments" className="pt-5" ref={containerRef}>
        {children}
      </div>
    </CommentsContext.Provider>
  )
}

function CommentsHeader() {
  const ctx = useCommentsContext('Comments.Header')
  return (
    <div className="text-[1.25rem] font-semibold leading-[1.4] mb-4">
      评论 <small className="text-sm">({ctx.totalCount})</small>
    </div>
  )
}

// Renders the reply form only when no comment is the active reply target —
// i.e. the top-level "Leave a reply" position. Reply forms anchored under a
// specific comment travel through the recursive `CommentItem` tree.
function CommentsReplyFormSlot() {
  const ctx = useCommentsContext('Comments.ReplyFormSlot')
  if (ctx.activeReplyToId !== 0) return null
  return <>{ctx.replyForm}</>
}

function CommentsList() {
  const ctx = useCommentsContext('Comments.List')
  return (
    <ul>
      {ctx.state.items.map((item) => (
        <CommentItem key={asKey(item.id)} comment={item} depth={1} />
      ))}
    </ul>
  )
}

function CommentsLoadMore() {
  const ctx = useCommentsContext('Comments.LoadMore')
  const pageSize = config.settings.comments.size

  // Pin the latest `rootsLoaded` so the success callback can compute the
  // new offset without forcing the hook to remount on every dispatch.
  const rootsLoadedRef = useRef(ctx.state.rootsLoaded)
  rootsLoadedRef.current = ctx.state.rootsLoaded

  const loadMore = useApiFetcher<never, LoadCommentsOutput>(API_ACTIONS.comment.loadComments, {
    onSuccess: (payload) => {
      ctx.dispatch({
        type: 'append',
        items: payload.comments,
        rootsLoaded: rootsLoadedRef.current + payload.comments.length,
      })
    },
  })

  if (ctx.state.rootsLoaded >= ctx.state.rootsTotal) return null

  const moreLoading = loadMore.isPending
  const onLoadMore = () => {
    if (loadMore.isPending) return
    loadMore.load({
      page_key: ctx.commentKey,
      offset: ctx.state.rootsLoaded,
    } satisfies LoadCommentsInput)
  }

  return (
    <div className="text-center mt-3 md:mt-4">
      <Button
        tone="neutral"
        onClick={onLoadMore}
        disabled={moreLoading}
        data-key={ctx.commentKey}
        data-size={pageSize}
        data-offset={ctx.state.rootsLoaded}
      >
        {moreLoading ? '加载中...' : '加载更多'}
      </Button>
    </div>
  )
}

function findComment(items: CommentItemType[], rid: number): CommentItemType | undefined {
  const target = asKey(rid)
  for (const item of items) {
    if (asKey(item.id) === target) return item
    if (item.children && item.children.length > 0) {
      const inner = findComment(item.children, rid)
      if (inner) return inner
    }
  }
  return undefined
}

Comments.Header = CommentsHeader
Comments.ReplyFormSlot = CommentsReplyFormSlot
Comments.List = CommentsList
Comments.LoadMore = CommentsLoadMore

export type { CommentTreeAction, CommentTreeState }
