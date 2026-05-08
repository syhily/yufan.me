import { Trash2Icon, XIcon } from 'lucide-react'
import { useRef } from 'react'

import type { CacheBucketStats, ClearCacheTarget } from '@/shared/cache-types'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/alert-dialog'

interface ConfirmClearDialogProps {
  open: boolean
  target: ClearCacheTarget | null
  buckets: CacheBucketStats[]
  onConfirm: () => void
  onCancel: () => void
}

// Confirmation modal shared by both the per-bucket clear buttons and
// the "清空全部缓存" CTA. The dialog is rendered with `open` driven
// by the parent's `confirmTarget !== null`. When the user clicks
// 取消 the parent flips `confirmTarget` back to `null`, which (a)
// starts the close animation and (b) immediately resets every prop
// derived from `target`. Without a snapshot the title would morph
// from "清空全部缓存？" to "清空「」缓存？" and the action button
// from "确认清空全部" to "确认清空" *during* the fade-out — exactly
// the regression #2403 reported. We cache the last truthy `target`
// so the in-flight close animation keeps rendering the contents the
// user just saw, without ever crossing back to a stale value once
// the dialog reopens.
export function ConfirmClearDialog({ open, target, buckets, onConfirm, onCancel }: ConfirmClearDialogProps) {
  const lastTargetRef = useRef<ClearCacheTarget | null>(target)
  if (target !== null) {
    lastTargetRef.current = target
  }
  const renderTarget = target ?? lastTargetRef.current
  const isAll = renderTarget === 'all'
  const bucket = !isAll && renderTarget ? buckets.find((entry) => entry.id === renderTarget) : null
  const total = isAll ? buckets.reduce((sum, entry) => sum + entry.keyCount, 0) : (bucket?.keyCount ?? 0)
  const title = isAll ? '清空全部缓存？' : `清空「${bucket?.label ?? ''}」缓存？`
  const description = isAll
    ? `本次操作会通过 SCAN 找出全部 ${total} 个 Redis 键并 UNLINK 删除。下一次访问 OG 图 / 头像 / 日历会重新生成或拉取，可能短时间内增加服务器负载。该操作不可撤销。`
    : `本次操作会通过 SCAN 找出 ${total} 个匹配 ${bucket?.pattern ?? ''} 的 Redis 键并 UNLINK 删除。该操作不可撤销。`

  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? null : onCancel())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            <XIcon data-icon /> 取消
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            <Trash2Icon data-icon /> {isAll ? '确认清空全部' : '确认清空'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
