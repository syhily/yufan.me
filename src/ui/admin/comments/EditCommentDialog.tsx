import { SaveIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFetcher } from 'react-router'

import type { ApiEnvelope } from '@/shared/api-envelope'
import type { CommentEditOutput, CommentRawOutput } from '@/shared/api-types'
import type { AdminComment } from '@/shared/comments'

import { useFetcherResult } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { idStr } from '@/shared/tools'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Label } from '@/ui/components/ui/label'
import { Textarea } from '@/ui/components/ui/textarea'

const EDIT = API_ACTIONS.comment.edit
const GET_RAW = API_ACTIONS.comment.getRaw

export interface EditCommentDialogProps {
  comment: AdminComment | null
  onClose: () => void
  onSaved: (next: { content: string }) => void
}

export function EditCommentDialog({ comment, onClose, onSaved }: EditCommentDialogProps) {
  const rawFetcher = useFetcher<ApiEnvelope<CommentRawOutput>>()
  const editFetcher = useFetcher<ApiEnvelope<CommentEditOutput>>()
  const [value, setValue] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!comment) {
      setLoaded(false)
      setValue('')
      return
    }
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
      setValue(payload.content || '')
      setLoaded(true)
    },
  })

  useFetcherResult(editFetcher, {
    action: EDIT,
    onSuccess: (payload) => onSaved({ content: payload.comment.content ?? '' }),
  })

  const open = comment !== null
  const submitting = editFetcher.state !== 'idle'

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
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
            if (!value.trim()) {
              window.alert('评论内容不能为空')
              return
            }
            void editFetcher.submit(
              { rid: idStr(comment.id), content: value },
              { method: EDIT.method, encType: 'application/json', action: EDIT.path },
            )
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-comment-content">评论内容</Label>
            <Textarea
              id="edit-comment-content"
              rows={8}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={!loaded || submitting}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <XIcon data-icon /> 取消
            </Button>
            <Button type="submit" disabled={submitting || !loaded}>
              <SaveIcon data-icon /> {submitting ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
