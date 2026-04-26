import type { AdminComment } from '@/server/comments/types'

import { idStr } from '@/shared/tools'
import { AdminCommentCard } from '@/ui/admin/AdminCommentCard'

export interface AdminCommentListProps {
  comments: AdminComment[]
  onEditComment: (comment: AdminComment) => void
  onReplyComment: (comment: AdminComment) => void
  onEditUser: (comment: AdminComment) => void
  onApproved: (id: bigint) => void
  onDeleted: (id: bigint) => void
}

export function AdminCommentList({
  comments,
  onEditComment,
  onReplyComment,
  onEditUser,
  onApproved,
  onDeleted,
}: AdminCommentListProps) {
  if (comments.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center py-5">
          <p className="text-muted mb-0">暂无评论</p>
        </div>
      </div>
    )
  }
  return (
    <>
      {comments.map((comment) => (
        <AdminCommentCard
          key={idStr(comment.id)}
          comment={comment}
          onEdit={() => onEditComment(comment)}
          onReply={() => onReplyComment(comment)}
          onEditUser={() => onEditUser(comment)}
          onApproved={() => onApproved(comment.id)}
          onDeleted={() => onDeleted(comment.id)}
        />
      ))}
    </>
  )
}
