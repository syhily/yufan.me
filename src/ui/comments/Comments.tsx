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

export interface CommentsProps {
  commentKey: string
  comments: CommentsData | null
  items: CommentItemType[]
  user?: CommentFormUser
}

export interface CommentTreeState {
  items: CommentItemType[]
  /** Currently visible "root" count for "load more" pagination. */
  rootsLoaded: number
  /** Total root comments according to the latest server response. */
  rootsTotal: number
  /** Currently active reply target id, or 0 when replying to the root. */
  replyToId: number
}

type CommentTreeAction =
  | { type: 'reset'; items: CommentItemType[]; rootsTotal: number; rootsLoaded: number }
  | { type: 'append'; items: CommentItemType[]; rootsLoaded: number }
  | { type: 'insertReply'; comment: CommentItemType; rid: number }
  | { type: 'updateComment'; comment: CommentItemType }
  | { type: 'removeComment'; id: bigint | string }
  | { type: 'approveComment'; id: bigint | string }
  | { type: 'setReplyTo'; rid: number }

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

export function Comments({ commentKey, comments, items, user }: CommentsProps) {
  if (comments == null) {
    return (
      <div id="comments" className="comments pt-5">
        评论加载失败 ❌
      </div>
    )
  }

  return (
    <CommentsBody
      key={commentKey}
      commentKey={commentKey}
      initialItems={items}
      rootsCount={comments.roots_count}
      totalCount={comments.count}
      user={user}
    />
  )
}

interface CommentsBodyProps {
  commentKey: string
  initialItems: CommentItemType[]
  rootsCount: number
  totalCount: number
  user?: CommentFormUser
}

function CommentsBody({ commentKey, initialItems, rootsCount, totalCount, user }: CommentsBodyProps) {
  const pageSize = config.settings.comments.size
  const [state, dispatch] = useReducer(reducer, createCommentTreeState(initialItems, rootsCount))

  // Suppress iOS Safari's auto-zoom while any comment input/textarea is
  // focused, then restore the original viewport meta on blur.
  const containerRef = useRef<HTMLDivElement | null>(null)
  useIosNoZoomOnFocus(containerRef)

  const admin = user?.admin === true

  // Pin the latest `rootsLoaded` so the success callback can compute the
  // new offset without forcing the hook to remount on every dispatch.
  const rootsLoadedRef = useRef(state.rootsLoaded)
  rootsLoadedRef.current = state.rootsLoaded

  const loadMore = useApiFetcher<never, LoadCommentsOutput>(API_ACTIONS.comment.loadComments, {
    onSuccess: (payload) => {
      dispatch({
        type: 'append',
        items: payload.comments,
        rootsLoaded: rootsLoadedRef.current + payload.comments.length,
      })
    },
  })

  const onLoadMore = () => {
    if (loadMore.isPending) return
    loadMore.load({
      page_key: commentKey,
      offset: state.rootsLoaded,
    } satisfies LoadCommentsInput)
  }

  const handleReplyDispatched = (comment: CommentItemType, rid: number) => {
    dispatch({ type: 'insertReply', comment, rid })
    dispatch({ type: 'setReplyTo', rid: 0 })
  }

  // Focus the reply form's textarea after a Reply click. The form is rendered
  // through React (no need for `document.querySelector("#respond #content")`),
  // so we thread a ref into `<CommentReplyForm>` and let it expose the node.
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const focusReplyForm = useCallback(() => {
    const textarea = replyTextareaRef.current
    textarea?.focus({ preventScroll: true })
    textarea?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const onReplyClick = (rid: number) => {
    flushSync(() => {
      dispatch({ type: 'setReplyTo', rid })
    })
    focusReplyForm()
  }

  const onCancelReply = () => dispatch({ type: 'setReplyTo', rid: 0 })

  const showLoadMore = state.rootsLoaded < state.rootsTotal
  const moreLoading = loadMore.isPending
  const replyTarget = state.replyToId === 0 ? undefined : findComment(state.items, state.replyToId)
  const activeReplyToId = replyTarget ? state.replyToId : 0
  const replyForm = (
    <CommentReplyForm
      commentKey={commentKey}
      replyToId={activeReplyToId}
      replyTarget={replyTarget}
      user={user}
      onCancel={onCancelReply}
      onReplied={handleReplyDispatched}
      textareaRef={replyTextareaRef}
    />
  )

  return (
    <div id="comments" className="comments pt-5" ref={containerRef}>
      <div className="h5 mb-4 comment-total-count">
        评论 <small className="font-theme text-sm">({totalCount})</small>
      </div>
      {activeReplyToId === 0 && replyForm}
      <ul className="comment-list">
        {state.items.map((item) => (
          <ManagedCommentItem
            key={asKey(item.id)}
            comment={item}
            depth={1}
            admin={admin}
            replyToId={activeReplyToId}
            replyForm={replyForm}
            onReply={onReplyClick}
            onEdited={(c) => dispatch({ type: 'updateComment', comment: c })}
            onApproved={(id) => dispatch({ type: 'approveComment', id })}
            onDeleted={(id) => dispatch({ type: 'removeComment', id })}
          />
        ))}
      </ul>
      {showLoadMore && (
        <div className="text-center mt-3 mt-md-4">
          <button
            type="button"
            className="btn btn-light"
            onClick={onLoadMore}
            disabled={moreLoading}
            data-key={commentKey}
            data-size={pageSize}
            data-offset={state.rootsLoaded}
          >
            {moreLoading ? '加载中...' : '加载更多'}
          </button>
        </div>
      )}
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

interface ManagedCommentItemProps {
  comment: CommentItemType
  depth: number
  admin: boolean
  replyToId: number
  replyForm: React.ReactNode
  onReply: (rid: number) => void
  onEdited: (comment: CommentItemType) => void
  onApproved: (id: bigint | string) => void
  onDeleted: (id: bigint | string) => void
}

function ManagedCommentItem({
  comment,
  depth,
  admin,
  replyToId,
  replyForm,
  onReply,
  onEdited,
  onApproved,
  onDeleted,
}: ManagedCommentItemProps) {
  const isReplyTarget = replyToId !== 0 && asKey(comment.id) === asKey(replyToId)
  return (
    <CommentItem
      comment={comment}
      depth={depth}
      admin={admin}
      actions={{ onReply, onEdited, onApproved, onDeleted }}
      childrenTail={depth === 1 && isReplyTarget ? replyForm : undefined}
      afterComment={depth !== 1 && isReplyTarget ? replyForm : undefined}
      renderChild={(child) => (
        <ManagedCommentItem
          key={asKey(child.id)}
          comment={child}
          depth={depth + 1}
          admin={admin}
          replyToId={replyToId}
          replyForm={replyForm}
          onReply={onReply}
          onEdited={onEdited}
          onApproved={onApproved}
          onDeleted={onDeleted}
        />
      )}
    />
  )
}

export type { CommentTreeAction }
