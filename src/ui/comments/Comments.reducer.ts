import type { CommentItem as CommentItemType } from '@/server/comments/types'
import type { CommentNode, CommentTreeAction, CommentTreeState } from '@/ui/comments/comments-context'

// Pure tree-reducer for the comments island. Lives next to
// `Comments.tsx` because the orchestrator instantiates `useReducer`
// against it, and `tests/component.public-state-reset.test.ts` imports
// the matching `createCommentTreeState` factory + `commentTreeReducer`
// alias by their public-API names (re-exported by `Comments.tsx`).
//
// The store is normalised into a `Map<id, CommentNode>` plus a
// `roots: id[]` array so unrelated dispatches do not invalidate the
// entire subtree (the recursive `<CommentItem>` reads
// `useCommentNode(id)` instead of holding the wire-shape children).
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
    const { children, ...rest } = item
    const inner = ingestTree(children ?? [], byId)
    byId.set(id, { ...rest, childrenIds: inner.ids })
  }
  return { ids, byId }
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

export function commentTreeReducer(state: CommentTreeState, action: CommentTreeAction): CommentTreeState {
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
      pruneSubtree(byId, id)
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

// Materialise a normalised node back into the `CommentItemType` shape so
// `<CommentReplyForm>` can keep accepting the wire-shaped `replyTarget`
// it already understands. The reply overlay only reads `name` and
// `content`, so we hand back an empty children list rather than
// rebuilding the entire descendant subtree.
export function nodeToCommentItem(node: CommentNode): CommentItemType {
  const { childrenIds: _childrenIds, ...comment } = node
  return { ...comment, children: [] } as CommentItemType
}
