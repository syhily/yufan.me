import { SendIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFetcher } from 'react-router'

import type { ApiEnvelope } from '@/shared/api-envelope'
import type { ReplyCommentOutput } from '@/shared/api-types'
import type { AdminComment } from '@/shared/comments'
import type { CommentBody } from '@/shared/pt/comment-schema'

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
import { CommentBodyEditor, EMPTY_COMMENT_BODY, isCommentBodyBlank } from '@/ui/public/comments/CommentBodyEditor'

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
  // Reply body is PortableText, not plain text — the public reply form
  // posts the same shape, and the API perimeter validates against
  // `commentBodySchema`. Keeping the admin reply on the same editor
  // means the admin sees a live preview of badges / code / math /
  // footnotes exactly as a visitor would author them.
  const [body, setBody] = useState<CommentBody>(EMPTY_COMMENT_BODY)
  const [bodyKey, setBodyKey] = useState(0)

  useEffect(() => {
    // Reset the editor body whenever the dialog opens for a new
    // comment, or closes. Bumping `bodyKey` forces `CommentBodyEditor`
    // to remount its Tiptap instance so the previous reply doesn't
    // leak into the next one.
    setBody(EMPTY_COMMENT_BODY)
    setBodyKey((k) => k + 1)
  }, [comment?.id])

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
  const dialogKey = comment ? idStr(comment.id) : 'empty'

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
            if (isCommentBodyBlank(body)) {
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
                body,
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
            <CommentBodyEditor
              initialBody={EMPTY_COMMENT_BODY}
              bodyKey={`admin-reply-${dialogKey}-${bodyKey}`}
              onBodyChange={setBody}
              disabled={submitting}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={onClose}>
              <XIcon data-icon /> 取消
            </Button>
            <Button type="submit" disabled={submitting} onMouseDown={(event) => event.preventDefault()}>
              <SendIcon data-icon /> {submitting ? '发送中…' : '发送回复'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
