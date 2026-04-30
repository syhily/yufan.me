import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/admin/shadcn/components/ui/alert-dialog'
import { Button } from '@/ui/admin/shadcn/components/ui/button'

interface SettingsFormBarProps {
  isPending: boolean
  isDirty: boolean
  status: 'idle' | 'saving' | 'saved' | 'error'
  errorMessage: string | null
  onReset: () => void
  /**
   * Optional confirmation copy for the destructive "重置为默认" action. When
   * omitted a generic dialog is rendered.
   */
  resetTitle?: string
  resetDescription?: string
}

// Bottom sticky action bar shared by every settings form. Holds the
// "Save" submit (the form's own `<button type="submit">`) implicitly via
// the parent `<form>` wiring, plus a "Reset to defaults" destructive
// action gated by an `AlertDialog`.
//
// The save button is rendered through the parent `<form>`'s submit
// behaviour (this component only owns the surrounding bar + reset
// button), so the parent form keeps a single source of truth for the
// submit handler.
export function SettingsFormBar({
  isPending,
  isDirty,
  status,
  errorMessage,
  onReset,
  resetTitle = '重置该分组的所有字段为默认？',
  resetDescription = '该分组在数据库中的覆盖值会被清除，下次读取将回退到 blog.config.ts 的默认值。该操作不可撤销。',
}: SettingsFormBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:pt-4">
        <div className="tw:flex tw:items-center tw:gap-2 tw:text-sm">
          {status === 'saved' && !isDirty ? (
            <span className="tw:text-muted-foreground">已保存</span>
          ) : status === 'error' ? (
            <span className="tw:text-destructive">{errorMessage ?? '保存失败'}</span>
          ) : isDirty ? (
            <span className="tw:text-muted-foreground">尚未保存的更改</span>
          ) : (
            <span className="tw:text-muted-foreground">无更改</span>
          )}
        </div>
        <div className="tw:flex tw:items-center tw:gap-2">
          <Button type="button" variant="destructive-soft" onClick={() => setConfirmOpen(true)} disabled={isPending}>
            重置为默认
          </Button>
          <Button type="submit" disabled={isPending || !isDirty}>
            {isPending ? '保存中…' : '保存更改'}
          </Button>
        </div>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{resetTitle}</AlertDialogTitle>
            <AlertDialogDescription>{resetDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false)
                onReset()
              }}
            >
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
