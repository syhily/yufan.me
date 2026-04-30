import { type SubmitEventHandler, useCallback, useEffect, useState } from 'react'

import type { BlogSettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { FieldRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsFetcher } from '@/ui/admin/settings/useSettingsFetcher'
import { Checkbox } from '@/ui/admin/shadcn/components/ui/checkbox'
import { Input } from '@/ui/admin/shadcn/components/ui/input'

interface SidebarFormProps {
  settings: BlogSettings
  csrfToken: string
}

interface FormState {
  calendar: boolean
  search: boolean
  comment: number
  post: number
  tag: number
}

function snapshotFromSettings(settings: BlogSettings): FormState {
  return { ...settings.settings.sidebar }
}
function statesEqual(a: FormState, b: FormState): boolean {
  return (
    a.calendar === b.calendar &&
    a.search === b.search &&
    a.comment === b.comment &&
    a.post === b.post &&
    a.tag === b.tag
  )
}

export function SidebarForm({ settings, csrfToken: _csrfToken }: SidebarFormProps) {
  const [snapshot, setSnapshot] = useState<FormState>(() => snapshotFromSettings(settings))
  const [draft, setDraft] = useState<FormState>(snapshot)

  useEffect(() => {
    const fresh = snapshotFromSettings(settings)
    setSnapshot(fresh)
    setDraft(fresh)
  }, [settings])

  const isDirty = !statesEqual(draft, snapshot)
  const onSaved = useCallback(() => setSnapshot(draft), [draft])
  const { save, isPending, status, errorMessage } = useSettingsFetcher({
    section: 'sidebar',
    onSaved,
  })

  const onSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    save({ sidebar: draft })
  }

  return (
    <form onSubmit={onSubmit} className="tw:flex tw:flex-col tw:gap-6">
      <SettingsSection title="侧边栏组件" description="控制侧边栏的功能模块。把数量设为 0 等于隐藏对应模块。">
        <FieldRow label="日历组件" hint="文章按月份归档的小日历。">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Checkbox
              id="sidebar-calendar"
              checked={draft.calendar}
              onCheckedChange={(value) => setDraft((prev) => ({ ...prev, calendar: value === true }))}
            />
            <label htmlFor="sidebar-calendar" className="tw:text-sm tw:select-none">
              显示日历
            </label>
          </div>
        </FieldRow>
        <FieldRow label="搜索框" hint="文章标题关键字快速搜索。">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Checkbox
              id="sidebar-search-toggle"
              checked={draft.search}
              onCheckedChange={(value) => setDraft((prev) => ({ ...prev, search: value === true }))}
            />
            <label htmlFor="sidebar-search-toggle" className="tw:text-sm tw:select-none">
              显示搜索框
            </label>
          </div>
        </FieldRow>
        <FieldRow label="最近评论数量" htmlFor="sidebar-comment">
          <Input
            id="sidebar-comment"
            type="number"
            min={0}
            max={50}
            value={draft.comment}
            onChange={(e) => setDraft((prev) => ({ ...prev, comment: Number.parseInt(e.target.value, 10) || 0 }))}
          />
        </FieldRow>
        <FieldRow label="推荐文章数量" htmlFor="sidebar-post">
          <Input
            id="sidebar-post"
            type="number"
            min={0}
            max={50}
            value={draft.post}
            onChange={(e) => setDraft((prev) => ({ ...prev, post: Number.parseInt(e.target.value, 10) || 0 }))}
          />
        </FieldRow>
        <FieldRow label="标签云数量" htmlFor="sidebar-tag" hint="从全部标签里随机抽取展示。">
          <Input
            id="sidebar-tag"
            type="number"
            min={0}
            max={100}
            value={draft.tag}
            onChange={(e) => setDraft((prev) => ({ ...prev, tag: Number.parseInt(e.target.value, 10) || 0 }))}
          />
        </FieldRow>
      </SettingsSection>

      <SettingsFormBar isPending={isPending} isDirty={isDirty} status={status} errorMessage={errorMessage} />
    </form>
  )
}
