import { CheckIcon, CopyIcon, ExternalLinkIcon, RefreshCwIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { AdminImageDto } from '@/shared/images'

import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'

interface ImageDetailDialogProps {
  image: AdminImageDto | null
  open: boolean
  onClose: () => void
  copied: boolean
  isSavingNote: boolean
  isRecalculatingThumbhash: boolean
  onCopyUrl: (image: AdminImageDto) => void
  onSaveNote: (image: AdminImageDto, note: string | null) => void
  onDelete: (image: AdminImageDto) => void
  onRecalculateThumbhash: (image: AdminImageDto) => void
}

// Image library detail dialog. Owns the full preview and every meta
// field that used to live as a separate table column (path, public
// URL, dimensions, byte size, uploader, timestamps, note). The parent
// view remains a pure thumbnail grid; clicking a card opens this
// dialog.
//
// The note edit affordance lives inside the dialog (not in a separate
// flow) so the operator never has to bounce between dialog and grid:
// click → reveal → save / cancel → close. The delete affordance still
// hands off to the existing `ConfirmDialog` via `onDelete`.
export function ImageDetailDialog({
  image,
  open,
  onClose,
  copied,
  isSavingNote,
  isRecalculatingThumbhash,
  onCopyUrl,
  onSaveNote,
  onDelete,
  onRecalculateThumbhash,
}: ImageDetailDialogProps) {
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || image === null) {
      setEditingNote(false)
      setNoteDraft('')
      return
    }
    setEditingNote(false)
    setNoteDraft(image.note ?? '')
  }, [open, image])

  useEffect(() => {
    if (editingNote) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editingNote])

  if (image === null) {
    return null
  }

  const currentNote = image.note ?? ''
  const commitNote = () => {
    const trimmed = noteDraft.trim()
    const next = trimmed === '' ? null : trimmed
    if ((next ?? '') !== currentNote) {
      onSaveNote(image, next)
    }
    setEditingNote(false)
  }
  const cancelEdit = () => {
    setNoteDraft(currentNote)
    setEditingNote(false)
  }

  const fileName = image.storagePath.split('/').pop() ?? image.storagePath

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-hidden p-0 outline-none">
        <div className="flex max-h-[calc(100vh-2rem)] flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="truncate">{fileName}</DialogTitle>
            <DialogDescription className="truncate">{image.storagePath}</DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-2">
            <div className="flex items-center justify-center rounded-md border bg-muted">
              {/* Plain <img>: this is the admin library, lazy-loaded
                  remote URL, alt="" because the file path + meta
                  fields below already convey the image identity. */}
              <img
                src={image.publicUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="max-h-[60vh] w-auto max-w-full rounded-md object-contain"
              />
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <MetaField label="尺寸">
                {image.width}×{image.height}
              </MetaField>
              <MetaField label="大小">{formatBytes(image.byteSize)}</MetaField>
              <MetaField label="MIME">{image.mimeType}</MetaField>
              <MetaField label="上传人">{image.uploaderName ?? '—'}</MetaField>
              <MetaField label="创建时间">{formatDateTime(image.createdAt)}</MetaField>
              <MetaField label="更新时间">{formatDateTime(image.updatedAt)}</MetaField>
            </dl>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">公开 URL</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded border bg-muted px-2 py-1 font-mono text-xs">
                  {image.publicUrl}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCopyUrl(image)}
                  aria-label="复制公开 URL"
                >
                  {copied ? <CheckIcon data-icon /> : <CopyIcon data-icon />}
                  {copied ? '已复制' : '复制'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  render={
                    <a href={image.publicUrl} target="_blank" rel="nofollow noreferrer" aria-label="在新标签页打开">
                      <ExternalLinkIcon data-icon /> 打开
                    </a>
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">备注</Label>
              {editingNote ? (
                <Input
                  ref={inputRef}
                  value={noteDraft}
                  maxLength={200}
                  disabled={isSavingNote}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onBlur={commitNote}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitNote()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelEdit()
                    }
                  }}
                  placeholder="便于后台搜索（如「2024 年终总结题图」）"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNoteDraft(currentNote)
                    setEditingNote(true)
                  }}
                  className="cursor-text rounded border border-transparent px-2 py-1 text-left text-sm transition-colors outline-none hover:border-input hover:bg-muted/50 focus-visible:border-input focus-visible:bg-muted/50"
                  title="点击编辑"
                >
                  {image.note || <span className="text-muted-foreground">— 点击添加备注 —</span>}
                </button>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="destructive" onClick={() => onDelete(image)}>
              <Trash2Icon data-icon /> 删除
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onRecalculateThumbhash(image)}
                disabled={isRecalculatingThumbhash}
              >
                <RefreshCwIcon data-icon className={isRecalculatingThumbhash ? 'animate-spin' : ''} />{' '}
                {isRecalculatingThumbhash ? '计算中…' : '重新计算 thumbhash'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                <XIcon data-icon /> 关闭
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  return `${bytes} B`
}

function formatDateTime(iso: string): string {
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) {
      return iso
    }
    return date.toLocaleString()
  } catch {
    return iso
  }
}
