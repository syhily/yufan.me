import { CheckIcon, CopyIcon, ExternalLinkIcon, PencilIcon, RefreshCwIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

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

  // Reset the edit affordance every time the dialog opens against a
  // new image. The previous edit state would otherwise leak into the
  // next dialog if the operator closes mid-edit.
  useEffect(() => {
    if (!open || image === null) {
      setEditingNote(false)
      setNoteDraft('')
      return
    }
    setEditingNote(false)
    setNoteDraft(image.note ?? '')
  }, [open, image])

  if (image === null) {
    return null
  }

  const fileName = image.storagePath.split('/').pop() ?? image.storagePath

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-hidden p-0">
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
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">备注</Label>
                {!editingNote ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingNote(true)
                      setNoteDraft(image.note ?? '')
                    }}
                  >
                    <PencilIcon data-icon /> 编辑
                  </Button>
                ) : null}
              </div>
              {editingNote ? (
                <div className="flex flex-col gap-2">
                  <Input
                    value={noteDraft}
                    maxLength={200}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="便于后台搜索（如「2024 年终总结题图」）"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const trimmed = noteDraft.trim()
                        onSaveNote(image, trimmed === '' ? null : trimmed)
                        setEditingNote(false)
                      }}
                      disabled={isSavingNote}
                    >
                      <CheckIcon data-icon /> 保存
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingNote(false)
                        setNoteDraft(image.note ?? '')
                      }}
                      disabled={isSavingNote}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm">{image.note || <span className="text-muted-foreground">— 暂无备注 —</span>}</p>
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
