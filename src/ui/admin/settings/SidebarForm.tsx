import type { SidebarSettings } from '@/shared/config/blog'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsCheckboxRow, SettingsRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Input } from '@/ui/components/input'

interface SidebarFormProps {
  // Per-section DTO: matches `setting('blog.sidebar')`.
  sidebar: SidebarSettings
}

interface FormState {
  calendar: boolean
  search: boolean
  comment: number
  post: number
  tag: number
}

export function SidebarForm({ sidebar }: SidebarFormProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    SidebarSettings,
    FormState
  >({
    section: 'sidebar',
    source: sidebar,
    toState: (source) => ({ ...source.sidebar }),
    fromState: (state) => ({ sidebar: state }),
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection title="侧边栏组件" description="控制侧边栏的功能模块。把数量设为 0 等于隐藏对应模块。">
        <SettingsCheckboxRow
          id="sidebar-calendar"
          rowLabel="日历组件"
          checkboxLabel="显示日历"
          hint="文章按月份归档的小日历。"
          checked={draft.calendar}
          onCheckedChange={(value) => setDraft((prev) => ({ ...prev, calendar: value }))}
        />
        <SettingsCheckboxRow
          id="sidebar-search-toggle"
          rowLabel="搜索框"
          checkboxLabel="显示搜索框"
          hint="文章标题关键字快速搜索。"
          checked={draft.search}
          onCheckedChange={(value) => setDraft((prev) => ({ ...prev, search: value }))}
        />
        <SettingsRow label="最近评论数量" htmlFor="sidebar-comment">
          <Input
            id="sidebar-comment"
            type="number"
            min={0}
            max={50}
            value={draft.comment}
            onChange={(e) => setDraft((prev) => ({ ...prev, comment: Number.parseInt(e.target.value, 10) || 0 }))}
          />
        </SettingsRow>
        <SettingsRow label="推荐文章数量" htmlFor="sidebar-post">
          <Input
            id="sidebar-post"
            type="number"
            min={0}
            max={50}
            value={draft.post}
            onChange={(e) => setDraft((prev) => ({ ...prev, post: Number.parseInt(e.target.value, 10) || 0 }))}
          />
        </SettingsRow>
        <SettingsRow label="标签云数量" htmlFor="sidebar-tag" hint="从全部标签里随机抽取展示。">
          <Input
            id="sidebar-tag"
            type="number"
            min={0}
            max={100}
            value={draft.tag}
            onChange={(e) => setDraft((prev) => ({ ...prev, tag: Number.parseInt(e.target.value, 10) || 0 }))}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsFormBar
        isPending={isPending}
        isDirty={isDirty}
        status={status}
        errorMessage={errorMessage}
        onRevert={revert}
      />
    </form>
  )
}
