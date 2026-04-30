import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'

import type { CommentEditOutput, CommentRawOutput } from '@/client/api/action-types'
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

  useEffect(() => {
    if (rawFetcher.state !== 'idle' || !rawFetcher.data || loaded) return
    if (rawFetcher.data.data) {
      setValue(rawFetcher.data.data.content || '')
      setLoaded(true)
    }
  }, [rawFetcher.state, rawFetcher.data, loaded])

  // One-shot guard so an unstable parent `onSaved` closure can't make
  // this effect re-fire while `editFetcher.data` is still set. See
  // `EditUserDialog.tsx` for the full rationale.
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved
  const lastHandled = useRef<unknown>(null)
  useEffect(() => {
    if (editFetcher.state !== 'idle' || !editFetcher.data) return
    if (editFetcher.data === lastHandled.current) return
    lastHandled.current = editFetcher.data
    if (editFetcher.data.error) {
      console.error('[admin] edit failed', editFetcher.data.error)
      return
    }
    if (editFetcher.data.data) {
      onSavedRef.current({ content: editFetcher.data.data.comment.content ?? '' })
    }
  }, [editFetcher.state, editFetcher.data])

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
            if (!comment) return
            if (!value.trim()) {
              window.alert('评论内容不能为空')
              return
            }
            void editFetcher.submit(
              { rid: idStr(comment.id), content: value },
              { method: EDIT.method, encType: 'application/json', action: EDIT.path },
            )
          }}
          className="tw:flex tw:flex-col tw:gap-4"
        >
          <div className="tw:flex tw:flex-col tw:gap-2">
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
              取消
            </Button>
            <Button type="submit" disabled={submitting || !loaded}>
              {submitting ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
