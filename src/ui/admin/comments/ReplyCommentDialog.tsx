import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'

import type { ReplyCommentOutput } from '@/client/api/action-types'
import type { AdminComment } from '@/server/comments/types'

import { API_ACTIONS } from '@/client/api/actions'
import { idStr } from '@/shared/tools'
import { Button } from '@/ui/admin/shadcn/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/admin/shadcn/components/ui/dialog'
import { Label } from '@/ui/admin/shadcn/components/ui/label'
import { Textarea } from '@/ui/admin/shadcn/components/ui/textarea'

interface ApiEnvelope<T> {
  data?: T
  error?: { message: string }
}

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
    if (!comment) setValue('')
  }, [comment])

  // Same one-shot guard as `EditUserDialog`. Without the
  // `lastHandled` ref + ref-stashed callbacks, an unstable `onReplied`
  // closure (the parent's `reload()` is regenerated each render of
  // `CommentsView`) would re-enter this branch while `fetcher.data` is
  // still set and trigger a runaway loop of `loadAll` requests.
  const onCsrfRotatedRef = useRef(onCsrfRotated)
  onCsrfRotatedRef.current = onCsrfRotated
  const onRepliedRef = useRef(onReplied)
  onRepliedRef.current = onReplied
  const lastHandled = useRef<unknown>(null)
  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return
    if (fetcher.data === lastHandled.current) return
    lastHandled.current = fetcher.data
    if (fetcher.data.error) {
      console.error('[admin] reply failed', fetcher.data.error)
      return
    }
    if (fetcher.data.data?.csrfToken) {
      onCsrfRotatedRef.current(fetcher.data.data.csrfToken)
    }
    onRepliedRef.current()
  }, [fetcher.state, fetcher.data])

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
            if (!comment) return
            if (!value.trim()) {
              window.alert('回复内容不能为空')
              return
            }
            if (!authorEmail) {
              window.alert('无法获取管理员邮箱，请刷新页面重试')
              return
            }
            void fetcher.submit(
              {
                page_key: comment.pageKey,
                name: authorName,
                email: authorEmail,
                content: value,
                rid: Number.parseInt(idStr(comment.id), 10),
                csrf: csrfToken,
              },
              { method: REPLY.method, encType: 'application/json', action: REPLY.path },
            )
          }}
          className="tw:flex tw:flex-col tw:gap-4"
        >
          <div className="tw:flex tw:flex-col tw:gap-2">
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
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '发送中…' : '发送回复'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
