import { Button } from '@/ui/admin/shadcn/components/ui/button'

interface SettingsFormBarProps {
  isPending: boolean
  isDirty: boolean
  status: 'idle' | 'saving' | 'saved' | 'error'
  errorMessage: string | null
}

// Bottom sticky action bar shared by every settings form. Holds the
// "保存更改" submit (rendered through the parent `<form>`'s submit
// behaviour) plus an inline status message. The destructive
// "重置为默认" affordance was removed alongside `DEFAULT_SETTINGS`
// — there are no defaults to roll back to anymore. Editors that want
// to clear a section should set the fields back to a blank value
// explicitly and save.
export function SettingsFormBar({ isPending, isDirty, status, errorMessage }: SettingsFormBarProps) {
  return (
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
        <Button type="submit" disabled={isPending || !isDirty}>
          {isPending ? '保存中…' : '保存更改'}
        </Button>
      </div>
    </div>
  )
}
