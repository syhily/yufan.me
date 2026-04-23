import type { CommentItem as CommentItemType } from '@/services/comments/types'

import { CommentItem } from '@/components/comment/CommentItem'

export interface CommentProps {
  comments: CommentItemType[]
  admin: boolean
}

export function Comment({ comments, admin }: CommentProps) {
  return (
    <>
      {comments.map((item) => (
        <CommentItem key={item.id} comment={item} depth={1} admin={admin} />
      ))}
    </>
  )
}
