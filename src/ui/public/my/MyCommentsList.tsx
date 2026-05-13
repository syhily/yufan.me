import { useFetcher, useRevalidator } from 'react-router'

import type { MyCommentItem } from '@/routes/my.comments'
import type { ApiEnvelope } from '@/shared/api-envelope'

import { useFetcherResult } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { Badge } from '@/ui/components/badge'
import { Button } from '@/ui/components/button'
import { PortableTextBody } from '@/ui/pt/render'

const REQUEST_DELETE = API_ACTIONS.comment.requestDeleteOwn
const CANCEL_DELETE = API_ACTIONS.comment.cancelDeleteOwn

interface Counts {
  total: number
  pending: number
  deleteRequested: number
}

export interface MyCommentsListProps {
  items: MyCommentItem[]
  counts: Counts
}

export function MyCommentsList({ items, counts }: MyCommentsListProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">我的评论</h1>
      <div className="text-sm text-muted-foreground">
        总计 {counts.total} 条 · 待审 {counts.pending} · 申请删除 {counts.deleteRequested}
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border bg-muted/40 p-6 text-center text-sm text-muted-foreground">暂无评论。</div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((c) => (
            <CommentRow key={c.id} item={c} />
          ))}
        </div>
      )}
    </div>
  )
}

function CommentRow({ item }: { item: MyCommentItem }) {
  const requestDelete = useFetcher<ApiEnvelope<{ success: boolean }>>()
  const cancelDelete = useFetcher<ApiEnvelope<{ success: boolean }>>()
  const revalidator = useRevalidator()

  useFetcherResult(requestDelete, {
    action: REQUEST_DELETE,
    onSuccess: () => {
      void revalidator.revalidate()
    },
  })
  useFetcherResult(cancelDelete, {
    action: CANCEL_DELETE,
    onSuccess: () => {
      void revalidator.revalidate()
    },
  })

  const isDeleted = item.deletedAtIso !== null
  const hasPendingDelete = item.deleteRequestedAtIso !== null
  const submitting = requestDelete.state !== 'idle' || cancelDelete.state !== 'idle'

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{formatDate(item.createdAtIso)}</div>
        <div className="flex items-center gap-2">
          {item.isPending && <Badge variant="secondary">待审</Badge>}
          {hasPendingDelete && !isDeleted && <Badge variant="destructive">已申请删除</Badge>}
          {isDeleted && <Badge variant="outline">已删除</Badge>}
        </div>
      </div>
      <div className="prose prose-sm mt-2 max-w-none dark:prose-invert">
        <PortableTextBody body={item.body} />
      </div>
      {!isDeleted && (
        <div className="mt-2 flex items-center gap-2">
          {hasPendingDelete ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                void cancelDelete.submit(
                  { commentId: item.id },
                  { method: CANCEL_DELETE.method, encType: 'application/json', action: CANCEL_DELETE.path },
                )
              }}
            >
              撤回删除
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                void requestDelete.submit(
                  { commentId: item.id },
                  { method: REQUEST_DELETE.method, encType: 'application/json', action: REQUEST_DELETE.path },
                )
              }}
            >
              申请删除
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  if (!iso) {
    return ''
  }
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
