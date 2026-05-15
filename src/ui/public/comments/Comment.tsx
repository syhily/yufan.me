import type { CommentItemWire as CommentItemType } from '@/shared/contracts/_dtos'

import { CommentItem } from '@/ui/public/comments/CommentItem'

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
