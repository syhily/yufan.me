import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { flushSync } from 'react-dom'

import type { LoadCommentsInput, LoadCommentsStreamLine } from '@/client/api/action-types'
import type { CommentFormUser } from '@/server/catalog'
import type { CommentItem as CommentItemType, Comments as CommentsData } from '@/server/comments/types'

import { API_ACTIONS } from '@/client/api/actions'
import { useApiStream } from '@/client/api/stream'
import { useIosNoZoomOnFocus } from '@/client/hooks/use-ios-no-zoom'
import { CommentItem } from '@/ui/comments/CommentItem'
import { CommentReplyForm } from '@/ui/comments/CommentReplyForm'
import {
  type CommentNode,
  CommentsActionsContext,
  type CommentsActionsContextValue,
  CommentsMetaContext,
  type CommentsMetaContextValue,
  CommentsReplyFormContext,
  CommentsStateContext,
  type CommentTreeAction,
  type CommentTreeState,
  useCommentsActions,
  useCommentsMeta,
  useCommentsState,
  useRootReplyForm,
} from '@/ui/comments/comments-context'
import { Button } from '@/ui/primitives/Button'
import { useSiteConfig } from '@/ui/primitives/site-config'

export interface CommentsProps {
  commentKey: string
  comments: CommentsData | null
  items: CommentItemType[]
  user?: CommentFormUser
}

function asKey(value: bigint | string | number): string {
  return String(value)
}

// Walk the nested `CommentItemType` tree once, materialising each row into
// the normalised `Map<id, CommentNode>` and capturing per-parent
// `childrenIds`. The recursion is local to this function — every other
// reducer case operates on the flat store.
function ingestTree(
  items: CommentItemType[],
  byId: Map<string, CommentNode>,
): { ids: string[]; byId: Map<string, CommentNode> } {
  const ids: string[] = []
  for (const item of items) {
    const id = asKey(item.id)
    ids.push(id)
    // The wire shape carries the descendant subtree on `children`. Strip
    // it here so the normalised store only references descendants by id;
    // re-keying happens in the recursive call below.
    const { children, ...rest } = item
    const inner = ingestTree(children ?? [], byId)
    byId.set(id, { ...rest, childrenIds: inner.ids })
  }
  return { ids, byId }
}

function reducer(state: CommentTreeState, action: CommentTreeAction): CommentTreeState {
  switch (action.type) {
    case 'reset': {
      const byId = new Map<string, CommentNode>()
      const roots = ingestTree(action.items, byId).ids
      return {
        byId,
        roots,
        rootsTotal: action.rootsTotal,
        rootsLoaded: action.rootsLoaded,
        replyToId: 0,
      }
    }
    case 'append': {
      const byId = new Map(state.byId)
      const appendIds = ingestTree(action.items, byId).ids
      return {
        ...state,
        byId,
        roots: [...state.roots, ...appendIds],
        rootsLoaded: action.rootsLoaded,
      }
    }
    case 'appendOne': {
      const byId = new Map(state.byId)
      const ids = ingestTree([action.comment], byId).ids
      const id = ids[0]
      if (id === undefined) {
        return state
      }
      return {
        ...state,
        byId,
        roots: [...state.roots, id],
        rootsLoaded: state.rootsLoaded + 1,
      }
    }
    case 'setRootsTotal': {
      if (action.rootsTotal === state.rootsTotal) {
        return state
      }
      return { ...state, rootsTotal: action.rootsTotal }
    }
    case 'insertReply': {
      const byId = new Map(state.byId)
      const inserted = ingestTree([action.comment], byId).ids
      const insertedId = inserted[0]
      if (insertedId === undefined) {
        return state
      }
      if (action.rid === 0) {
        return {
          ...state,
          byId,
          roots: [...state.roots, insertedId],
          rootsTotal: state.rootsTotal + 1,
          rootsLoaded: state.rootsLoaded + 1,
        }
      }
      const ridKey = asKey(action.rid)
      const parent = byId.get(ridKey)
      if (parent === undefined) {
        return state
      }
      byId.set(ridKey, { ...parent, childrenIds: [...parent.childrenIds, insertedId] })
      return { ...state, byId }
    }
    case 'updateComment': {
      const id = asKey(action.comment.id)
      const existing = state.byId.get(id)
      if (existing === undefined) {
        return state
      }
      const byId = new Map(state.byId)
      // Preserve existing `childrenIds`: the edit endpoint returns the
      // comment shape without its descendants.
      const { children: _children, ...rest } = action.comment
      byId.set(id, { ...rest, childrenIds: existing.childrenIds })
      return { ...state, byId }
    }
    case 'removeComment': {
      const id = asKey(action.id)
      if (!state.byId.has(id)) {
        return state
      }
      const byId = new Map(state.byId)
      // Remove the row plus every descendant that hangs off it.
      pruneSubtree(byId, id)
      // Drop any direct child reference from any remaining parent.
      for (const [parentId, parent] of byId) {
        if (!parent.childrenIds.includes(id)) {
          continue
        }
        byId.set(parentId, {
          ...parent,
          childrenIds: parent.childrenIds.filter((childId) => childId !== id),
        })
      }
      const wasRoot = state.roots.includes(id)
      const roots = wasRoot ? state.roots.filter((rootId) => rootId !== id) : state.roots
      return { ...state, byId, roots }
    }
    case 'approveComment': {
      const id = asKey(action.id)
      const existing = state.byId.get(id)
      if (existing === undefined) {
        return state
      }
      const byId = new Map(state.byId)
      byId.set(id, { ...existing, isPending: false })
      return { ...state, byId }
    }
    case 'setReplyTo':
      return { ...state, replyToId: action.rid }
  }
}

function pruneSubtree(byId: Map<string, CommentNode>, id: string) {
  const node = byId.get(id)
  if (node === undefined) {
    return
  }
  for (const childId of node.childrenIds) {
    pruneSubtree(byId, childId)
  }
  byId.delete(id)
}

export function createCommentTreeState(items: CommentItemType[], rootsCount: number): CommentTreeState {
  const byId = new Map<string, CommentNode>()
  const roots = ingestTree(items, byId).ids
  return {
    byId,
    roots,
    rootsLoaded: Math.min(roots.length, rootsCount),
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

  const onReply = useCallback((rid: number) => {
    dispatch({ type: 'setReplyTo', rid })
  }, [])
  const onCancelReply = useCallback(() => dispatch({ type: 'setReplyTo', rid: 0 }), [])
  const onEdited = useCallback((comment: CommentItemType) => dispatch({ type: 'updateComment', comment }), [])
  const onApproved = useCallback((id: bigint | string) => dispatch({ type: 'approveComment', id }), [])
  const onDeleted = useCallback((id: bigint | string) => dispatch({ type: 'removeComment', id }), [])
  const onReplied = useCallback((comment: CommentItemType, rid: number) => {
    dispatch({ type: 'insertReply', comment, rid })
    dispatch({ type: 'setReplyTo', rid: 0 })
  }, [])

  // Drive textarea focus from `state.replyToId` instead of `flushSync`-ing the
  // dispatch. React 19's automatic batching survives, and the focus call
  // happens after the new tree commits.
  useEffect(() => {
    if (state.replyToId === 0) {
      return
    }
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

// Materialise a normalised node back into the `CommentItemType` shape so
// `<CommentReplyForm>` can keep accepting the wire-shaped `replyTarget`
// it already understands. The reply overlay only reads `name` and
// `content`, so we hand back an empty children list rather than
// rebuilding the entire descendant subtree.
function nodeToCommentItem(node: CommentNode): CommentItemType {
  const { childrenIds: _childrenIds, ...comment } = node
  return { ...comment, children: [] } as CommentItemType
}

function CommentsHeader() {
  const meta = useCommentsMeta('Comments.Header')
  return (
    <div className="text-[1.25rem] font-semibold leading-[1.4] mb-4">
      评论 <small className="text-sm">({meta.totalCount})</small>
    </div>
  )
}

// Renders the reply form only when no comment is the active reply target —
// i.e. the top-level "Leave a reply" position. Reply forms anchored under a
// specific comment travel through the recursive `CommentItem` tree. Reads
// only the State + ReplyForm contexts, so a fresh reply form identity does
// not invalidate the rest of the tree.
function CommentsReplyFormSlot() {
  const replyForm = useRootReplyForm()
  if (replyForm === null) {
    return null
  }
  return <>{replyForm}</>
}

function CommentsList() {
  const state = useCommentsState()
  if (state === null) {
    throw new Error('<Comments.List> must be rendered inside <Comments>')
  }
  return (
    <ul>
      {state.roots.map((id) => (
        <CommentItem key={id} id={id} depth={1} />
      ))}
    </ul>
  )
}

function CommentsLoadMore() {
  const meta = useCommentsMeta('Comments.LoadMore')
  const actions = useCommentsActions()
  const state = useCommentsState()
  const { settings } = useSiteConfig()
  const pageSize = settings.comments.size

  /**
   * Streaming variant: each NDJSON line is dispatched as it arrives so
   * roots paint top-down without waiting for the whole page. The reducer
   * is wrapped in `flushSync` so React commits each subtree synchronously
   * — otherwise React 19's automatic batching collapses the burst into a
   * single render that defeats the streaming UX.
   */
  const dispatchRef = useRef(actions.dispatch)
  dispatchRef.current = actions.dispatch

  const loadMore = useApiStream<LoadCommentsInput, LoadCommentsStreamLine>(API_ACTIONS.comment.loadComments, {
    onLine: (line) => {
      if (line.type === 'meta') {
        flushSync(() => dispatchRef.current({ type: 'setRootsTotal', rootsTotal: line.roots_count }))
        return
      }
      if (line.type === 'item') {
        flushSync(() => dispatchRef.current({ type: 'appendOne', comment: line.comment }))
      }
    },
  })

  if (state === null || state.rootsLoaded >= state.rootsTotal) {
    return null
  }

  const moreLoading = loadMore.isPending
  const onLoadMore = () => {
    if (loadMore.isPending) {
      return
    }
    loadMore.load({
      page_key: meta.commentKey,
      offset: state.rootsLoaded,
    } satisfies LoadCommentsInput)
  }

  return (
    <div className="text-center mt-3 md:mt-4">
      <Button
        tone="neutral"
        onClick={onLoadMore}
        disabled={moreLoading}
        data-key={meta.commentKey}
        data-size={pageSize}
        data-offset={state.rootsLoaded}
      >
        {moreLoading ? '加载中...' : '加载更多'}
      </Button>
    </div>
  )
}

Comments.Header = CommentsHeader
Comments.ReplyFormSlot = CommentsReplyFormSlot
Comments.List = CommentsList
Comments.LoadMore = CommentsLoadMore

export type { CommentTreeAction, CommentTreeState }
