import type { AdminPostDto } from '@/shared/types/posts'

import { Badge } from '@/ui/components/badge'

export function StatusBadge({ post }: { post: AdminPostDto }) {
  if (post.deletedAt !== null) {
    return <Badge variant="destructive">已删除</Badge>
  }
  if (!post.published) {
    return <Badge variant="secondary">未发布</Badge>
  }
  if (post.publishedRevisionId === null) {
    return <Badge variant="outline">仅草稿</Badge>
  }
  if (!post.visible) {
    return <Badge variant="outline">隐藏</Badge>
  }
  return <Badge>已发布</Badge>
}
