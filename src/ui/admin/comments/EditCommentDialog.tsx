import { SaveIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFetcher } from 'react-router'
import { toast } from 'sonner'

import type { CommentEditOutput, CommentRawOutput } from '@/client/api/legacy-types'
import type { ApiEnvelope } from '@/shared/api-envelope'
import type { AdminComment } from '@/shared/comments'
import type { CommentBody } from '@/shared/pt/comment-schema'

import { useFetcherResult } from '@/client/api/fetcher'
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

const EDIT = API_ACTIONS.comment.edit
const GET_RAW = API_ACTIONS.comment.getRaw

export interface EditCommentDialogProps {
  comment: AdminComment | null
  onClose: () => void
  onSaved: (next: { body: CommentBody }) => void
}

export function EditCommentDialog({ comment, onClose, onSaved }: EditCommentDialogProps) {
  const rawFetcher = useFetcher<ApiEnvelope<CommentRawOutput>>()
  const editFetcher = useFetcher<ApiEnvelope<CommentEditOutput>>()
  const [initialBody, setInitialBody] = useState<CommentBody>(EMPTY_COMMENT_BODY)
  const [body, setBody] = useState<CommentBody>(EMPTY_COMMENT_BODY)
  const [bodyKey, setBodyKey] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!comment) {
      setLoaded(false)
      setInitialBody(EMPTY_COMMENT_BODY)
      setBody(EMPTY_COMMENT_BODY)
      return
    }
    setLoaded(false)
    void rawFetcher.load(`${GET_RAW.path}?rid=${encodeURIComponent(idStr(comment.id))}`)
    // intentionally only refetch when comment id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment?.id])

  useFetcherResult(rawFetcher, {
    action: GET_RAW,
    onSuccess: (payload) => {
      if (loaded) {
        return
      }
      const loadedBody = (payload.body ?? []) as CommentBody
      setInitialBody(loadedBody)
      setBody(loadedBody)
      setBodyKey((k) => k + 1)
      setLoaded(true)
    },
  })

  useFetcherResult(editFetcher, {
    action: EDIT,
    onSuccess: (payload) => onSaved({ body: payload.comment.body }),
  })

  const open = comment !== null
  const submitting = editFetcher.state !== 'idle'
  const dialogKey = comment ? idStr(comment.id) : 'empty'

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑评论</DialogTitle>
          <DialogDescription>修改评论内容后保存，会立即在前台生效。</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!comment) {
              return
            }
            if (isCommentBodyBlank(body)) {
              toast.error('评论内容不能为空')
              return
            }
            void editFetcher.submit(
              { rid: idStr(comment.id), body },
              { method: EDIT.method, encType: 'application/json', action: EDIT.path },
            )
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-comment-content">评论内容</Label>
            <CommentBodyEditor
              initialBody={initialBody}
              bodyKey={`admin-edit-${dialogKey}-${bodyKey}`}
              onBodyChange={setBody}
              disabled={!loaded || submitting}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={onClose}>
              <XIcon data-icon /> 取消
            </Button>
            <Button type="submit" disabled={submitting || !loaded} onMouseDown={(event) => event.preventDefault()}>
              <SaveIcon data-icon /> {submitting ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
