import { CommentItem } from '@/ui/comments/CommentItem'
import { useCommentsMeta, useCommentsState, useRootReplyForm } from '@/ui/comments/comments-context'

// Compound subcomponents for the comments island. Lives next to
// `Comments.tsx` because they all live behind the `Comments.<X>` static
// surface. Each part reads only the contexts it needs so an unrelated
// dispatch never invalidates a sibling part.

// Renders the section heading + total count. Only consumes the meta
// context, so re-renders only when the comment key / total / admin / user
// identity changes.
export function CommentsHeader() {
  const meta = useCommentsMeta('Comments.Header')
  return (
    <div className="text-card-title font-semibold mb-4">
      评论 <small className="text-sm">({meta.totalCount})</small>
    </div>
  )
}

// Renders the reply form only when no comment is the active reply target —
// i.e. the top-level "Leave a reply" position. Reply forms anchored under a
// specific comment travel through the recursive `CommentItem` tree. Reads
// only the State + ReplyForm contexts, so a fresh reply form identity does
// not invalidate the rest of the tree.
export function CommentsReplyFormSlot() {
  const replyForm = useRootReplyForm()
  if (replyForm === null) {
    return null
  }
  return <>{replyForm}</>
}

// Renders the list of root comments. Each `<CommentItem>` reads its row
// through `useCommentNode(id)`, so this component only re-renders when
// the `roots` array reference changes (insert/delete/reorder).
export function CommentsList() {
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
