import type { AdminComment } from '@/services/comments/loader'

import { AdminCommentCard } from '@/components/admin/AdminCommentCard'

export interface AdminCommentListProps {
  comments: AdminComment[]
}

export function AdminCommentList({ comments }: AdminCommentListProps) {
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
        <AdminCommentCard key={String(comment.id)} comment={comment} />
      ))}
    </>
  )
}
