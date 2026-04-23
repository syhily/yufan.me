import type { Comments } from '@/services/comments/types'

import { CommentItem } from '@/components/comment/CommentItem'
import { parseComments } from '@/services/comments/loader'

export interface CommentProps {
  comments: Comments
  admin: boolean
}

export async function Comment({ comments, admin }: CommentProps) {
  const parsed = await parseComments(comments.comments)
  return (
    <>
      {parsed.map((item) => (
        <CommentItem key={item.id} comment={item} depth={1} admin={admin} />
      ))}
    </>
  )
}
