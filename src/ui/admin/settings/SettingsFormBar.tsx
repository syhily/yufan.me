import { SaveIcon, Undo2Icon } from 'lucide-react'

import { Button } from '@/ui/components/button'

interface SettingsFormBarProps {
  isPending: boolean
  isDirty: boolean
  status: 'idle' | 'saving' | 'saved' | 'error'
  errorMessage: string | null
  /**
   * Reload the form fields from the server snapshot, discarding the
   * user's local edits. Wired by the parent form to
   * `useSettingsFetcher`'s `revert` (which re-runs the settings layout
   * loader). Only called when there are unsaved edits — the button
   * itself only renders in that state.
   */
  onRevert: () => void
}

// Bottom sticky action bar shared by every settings form. Holds the
// "保存更改" submit (rendered through the parent `<form>`'s submit
// behaviour) plus, when the user has dirty edits, a "撤销更改"
// affordance that re-fetches the DB-backed snapshot via the layout
// loader and resets the form fields. The pristine state intentionally
// shows nothing on the left — once `已保存` fades, an empty status row
// reads as "all clean", which is the calmer baseline the user asked
// for. Save / error / dirty states still surface their own message.
//
// The status text lives inside a persistent `role="status"` live
// region so screen readers announce state transitions (保存中 →
// 已保存 / 保存失败) without the region being remounted on every
// transition.
export function SettingsFormBar({ isPending, isDirty, status, errorMessage, onRevert }: SettingsFormBarProps) {
  const statusMessage =
    status === 'saved' && !isDirty
      ? '已保存'
      : status === 'error'
        ? (errorMessage ?? '保存失败')
        : isDirty
          ? '尚未保存的更改'
          : ''
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <div
        role="status"
        aria-live="polite"
        className={
          status === 'error'
            ? 'flex items-center gap-2 text-sm text-destructive'
            : 'flex items-center gap-2 text-sm text-muted-foreground'
        }
      >
        {statusMessage}
      </div>
      <div className="flex items-center gap-2">
        {isDirty ? (
          // Match the "X 清除" affordance on the comments filter row —
          // `destructive-soft` reads as "discards a selection" (light
          // pink bg, magenta text → solid red on hover) without
          // shouting like a full destructive primary would.
          <Button type="button" variant="destructive-soft" disabled={isPending} onClick={onRevert}>
            <Undo2Icon data-icon /> 撤销更改
          </Button>
        ) : null}
        <Button type="submit" disabled={isPending || !isDirty}>
          <SaveIcon data-icon /> {isPending ? '保存中…' : '保存更改'}
        </Button>
      </div>
    </div>
  )
}
