import { ChartLineIcon, FilePenIcon, MessageSquareIcon, PinIcon, Trash2Icon, Undo2Icon } from 'lucide-react'
import { Link } from 'react-router'

import type { AdminPostDto } from '@/shared/types/posts'

import { StatusBadge } from '@/ui/admin/posts/StatusBadge'
import { Button } from '@/ui/components/button'
import { TableCell, TableRow } from '@/ui/components/table'

interface PostRowProps {
  post: AdminPostDto
  onDelete: () => void
  onRestore: () => void
}

export function PostRow({ post, onDelete, onRestore }: PostRowProps) {
  const isDeleted = post.deletedAt !== null
  return (
    <TableRow className={isDeleted ? 'opacity-60' : undefined}>
      <TableCell className="pl-4 align-top">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{post.title}</span>
          {post.pinnedAt !== null && (
            <span title="已置顶">
              <PinIcon className="size-3.5 text-status-warn-fg" />
            </span>
          )}
        </div>
        <Link
          to={`/posts/${post.slug}`}
          className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          /posts/{post.slug}
        </Link>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <p className="text-sm text-muted-foreground">{post.category || '—'}</p>
      </TableCell>
      <TableCell className="hidden w-24 text-center align-middle md:table-cell">
        <p className="text-sm text-muted-foreground">{post.authorName || '—'}</p>
      </TableCell>
      <TableCell className="text-center align-middle">
        <StatusBadge post={post} />
      </TableCell>
      <TableCell className="hidden align-middle text-sm lg:table-cell">
        {new Date(post.firstPublishedAt ?? post.publishedAt).toLocaleString('zh-CN')}
      </TableCell>
      <TableCell className="pr-4 text-right align-top">
        <div className="flex justify-end gap-2">
          {!isDeleted ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                title="查看评论"
                className="w-20 justify-start"
                render={
                  <Link to={`/admin/comments?pageKey=${encodeURIComponent(post.commentPublicId)}`}>
                    <MessageSquareIcon /> {post.commentCount}
                  </Link>
                }
              />
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link to={`/editor/post/${post.id}`}>
                    <FilePenIcon /> 编辑
                  </Link>
                }
              />
              <Button
                variant="ghost"
                size="sm"
                title="分析"
                render={
                  <Link to={`/admin/posts/${post.id}/analytics`}>
                    <ChartLineIcon />
                  </Link>
                }
              />
              <Button variant="ghost" size="sm" onClick={onDelete} title="删除">
                <Trash2Icon />
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onRestore} title="恢复">
              <Undo2Icon /> 恢复
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
