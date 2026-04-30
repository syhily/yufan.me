import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { type SubmitEventHandler, useCallback, useEffect, useState } from 'react'

import type { BlogSettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsFetcher } from '@/ui/admin/settings/useSettingsFetcher'
import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { Checkbox } from '@/ui/admin/shadcn/components/ui/checkbox'
import { Input } from '@/ui/admin/shadcn/components/ui/input'
import { Label } from '@/ui/admin/shadcn/components/ui/label'

interface NavigationEditorProps {
  settings: BlogSettings
  csrfToken: string
}

interface NavRow {
  text: string
  link: string
  newTab: boolean
}

function snapshotFromSettings(settings: BlogSettings): NavRow[] {
  return settings.navigation.map((item) => ({
    text: item.text,
    link: item.link,
    newTab: item.target === '_blank',
  }))
}

function rowsEqual(a: NavRow[], b: NavRow[]): boolean {
  if (a.length !== b.length) return false
  return a.every((row, index) => {
    const other = b[index]
    return row.text === other.text && row.link === other.link && row.newTab === other.newTab
  })
}

export function NavigationEditor({ settings, csrfToken: _csrfToken }: NavigationEditorProps) {
  const [snapshot, setSnapshot] = useState<NavRow[]>(() => snapshotFromSettings(settings))
  const [draft, setDraft] = useState<NavRow[]>(snapshot)

  useEffect(() => {
    const fresh = snapshotFromSettings(settings)
    setSnapshot(fresh)
    setDraft(fresh)
  }, [settings])

  const isDirty = !rowsEqual(draft, snapshot)

  const onSaved = useCallback(() => setSnapshot(draft), [draft])
  const { save, isPending, status, errorMessage } = useSettingsFetcher({
    section: 'navigation',
    onSaved,
  })

  const onSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    save({
      navigation: draft.map((row) => ({
        text: row.text.trim(),
        link: row.link.trim(),
        ...(row.newTab ? { target: '_blank' } : {}),
      })),
    })
  }

  const update = (index: number, patch: Partial<NavRow>) =>
    setDraft((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const remove = (index: number) => setDraft((prev) => prev.filter((_, i) => i !== index))
  const move = (index: number, direction: -1 | 1) => {
    setDraft((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }
  const add = () => setDraft((prev) => [...prev, { text: '', link: '/', newTab: false }])

  return (
    <form onSubmit={onSubmit} className="tw:flex tw:flex-col tw:gap-6">
      <SettingsSection
        title="导航菜单"
        description="顶部导航条目。顺序、标题、链接均可调整。最多 20 个，链接可以是站内绝对路径或完整外部 URL。"
      >
        <div className="tw:flex tw:flex-col tw:gap-3">
          {draft.length === 0 ? (
            <p className="tw:text-muted-foreground tw:text-sm">还没有任何菜单条目，点下方按钮新增一项。</p>
          ) : (
            draft.map((row, index) => (
              <div
                key={index}
                className="tw:bg-muted/30 tw:flex tw:flex-col tw:gap-3 tw:rounded-md tw:border tw:p-3 tw:sm:flex-row tw:sm:items-end"
              >
                <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-2 tw:sm:flex-row">
                  <div className="tw:flex tw:flex-col tw:gap-1 tw:sm:flex-1">
                    <Label htmlFor={`nav-text-${index}`}>显示文本</Label>
                    <Input
                      id={`nav-text-${index}`}
                      value={row.text}
                      onChange={(e) => update(index, { text: e.target.value })}
                      maxLength={40}
                      required
                    />
                  </div>
                  <div className="tw:flex tw:flex-col tw:gap-1 tw:sm:flex-1">
                    <Label htmlFor={`nav-link-${index}`}>链接</Label>
                    <Input
                      id={`nav-link-${index}`}
                      value={row.link}
                      onChange={(e) => update(index, { link: e.target.value })}
                      maxLength={200}
                      required
                      placeholder="/about 或 https://example.com"
                    />
                  </div>
                </div>
                <div className="tw:flex tw:items-center tw:gap-3">
                  <div className="tw:flex tw:items-center tw:gap-2">
                    <Checkbox
                      id={`nav-newtab-${index}`}
                      checked={row.newTab}
                      onCheckedChange={(value) => update(index, { newTab: value === true })}
                    />
                    <label htmlFor={`nav-newtab-${index}`} className="tw:text-sm tw:select-none">
                      新窗口打开
                    </label>
                  </div>
                  <div className="tw:flex tw:gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="上移"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUpIcon className="tw:size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="下移"
                      disabled={index === draft.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDownIcon className="tw:size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive-soft"
                      size="icon"
                      aria-label="删除条目"
                      onClick={() => remove(index)}
                    >
                      <Trash2Icon className="tw:size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={draft.length >= 20}>
            <PlusIcon className="tw:size-4" />
            添加菜单项
          </Button>
        </div>
      </SettingsSection>

      <SettingsFormBar isPending={isPending} isDirty={isDirty} status={status} errorMessage={errorMessage} />
    </form>
  )
}
