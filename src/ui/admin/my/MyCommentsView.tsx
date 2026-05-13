import { MessageSquareIcon, Trash2Icon, Undo2Icon } from 'lucide-react'
import { useState } from 'react'

import { useAdminMutation } from '@/client/api/use-admin-mutation'
import { API_ACTIONS } from '@/shared/api-actions'
import { formatLocalDate } from '@/shared/formatter'
import { Badge } from '@/ui/components/badge'
import { Button } from '@/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/ui/components/empty'
import { Skeleton } from '@/ui/components/skeleton'

const LIST = API_ACTIONS.comment.listMine
const REQUEST_DELETE = API_ACTIONS.comment.requestDeleteOwn
const CANCEL_DELETE = API_ACTIONS.comment.cancelDeleteOwn

interface CommentRow {
  id: string
  content: string
  createdAt: string
  type: string
  isPending: boolean
  deleteRequestedAt: string | null
}

export function MyCommentsView({ csrfToken, userId }: { csrfToken: string; userId: string }) {
  const [page] = useState(0)
  const listApi = useAdminMutation<{ offset: number; limit: number }, { comments: CommentRow[]; total: number }>(LIST)
  const reload = () => listApi.submit({ offset: page * 20, limit: 20 })
  const requestDelete = useAdminMutation<{ commentId: string }, { ok: boolean }>(REQUEST_DELETE, {
    onSuccess: reload,
  })
  const cancelDelete = useAdminMutation<{ commentId: string }, { ok: boolean }>(CANCEL_DELETE, {
    onSuccess: reload,
  })

  const data = listApi.data
  const comments: CommentRow[] = data?.comments ?? []

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareIcon className="size-5" />
            我的评论
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listApi.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : comments.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquareIcon />
                </EmptyMedia>
                <EmptyTitle>暂无评论</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start justify-between rounded-md border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{c.content || '(无内容)'}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatLocalDate(c.createdAt, 'yyyy-LL-dd HH:mm')}
                      </span>
                      {c.isPending && (
                        <Badge variant="secondary" className="text-xs">
                          审核中
                        </Badge>
                      )}
                      {c.deleteRequestedAt && (
                        <Badge variant="destructive" className="text-xs">
                          已申请删除
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 gap-1">
                    {c.deleteRequestedAt ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelDelete.submit({ commentId: c.id })}
                        disabled={cancelDelete.isPending}
                      >
                        <Undo2Icon className="size-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => requestDelete.submit({ commentId: c.id })}
                        disabled={requestDelete.isPending}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
