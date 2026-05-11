import { SendIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFetcher } from 'react-router'

import type { ApiEnvelope } from '@/shared/api-envelope'
import type { ReplyCommentOutput } from '@/shared/api-types'
import type { AdminComment } from '@/shared/comments'

import { useFetcherResult } from '@/client/api/fetcher'
import { toast } from '@/client/api/use-admin-mutation'
import { API_ACTIONS } from '@/shared/api-actions'
import { idStr } from '@/shared/tools'
import { Button } from '@/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog'
import { Label } from '@/ui/components/label'
import { Textarea } from '@/ui/components/textarea'

const REPLY = API_ACTIONS.comment.replyComment

export interface ReplyCommentDialogProps {
  comment: AdminComment | null
  authorName: string
  authorEmail: string
  csrfToken: string
  onClose: () => void
  onReplied: () => void
  onCsrfRotated: (token: string) => void
}

export function ReplyCommentDialog({
  comment,
  authorName,
  authorEmail,
  csrfToken,
  onClose,
  onReplied,
  onCsrfRotated,
}: ReplyCommentDialogProps) {
  const fetcher = useFetcher<ApiEnvelope<ReplyCommentOutput>>()
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!comment) {
      setValue('')
    }
  }, [comment])

  // `useFetcherResult` already memoises against `fetcher.data` identity
  // and ref-stashes the callbacks, so an unstable parent `onReplied`
  // closure can't re-enter this branch and trigger the historical
  // runaway loop of `loadAll` requests.
  useFetcherResult(fetcher, {
    action: REPLY,
    onSuccess: (payload) => {
      if (payload.csrfToken) {
        onCsrfRotated(payload.csrfToken)
      }
      onReplied()
    },
  })

  const open = comment !== null
  const submitting = fetcher.state !== 'idle'

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>回复评论</DialogTitle>
          <DialogDescription>
            以管理员身份 ({authorName}) 回复 {comment?.name ?? ''} 的评论。
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!comment) {
              return
            }
            if (!value.trim()) {
              toast.error('回复内容不能为空')
              return
            }
            if (!authorEmail) {
              toast.error('无法获取管理员邮箱，请刷新页面重试')
              return
            }
            if (!comment.pagePublicId) {
              toast.error('该评论缺少有效的目标页面标识，无法回复')
              return
            }
            void fetcher.submit(
              {
                page_key: comment.pagePublicId,
                name: authorName,
                email: authorEmail,
                content: value,
                rid: Number.parseInt(idStr(comment.id), 10),
                csrf: csrfToken,
              },
              { method: REPLY.method, encType: 'application/json', action: REPLY.path },
            )
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="reply-comment-content">回复内容</Label>
            <Textarea
              id="reply-comment-content"
              rows={8}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <XIcon data-icon /> 取消
            </Button>
            <Button type="submit" disabled={submitting}>
              <SendIcon data-icon /> {submitting ? '发送中…' : '发送回复'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
