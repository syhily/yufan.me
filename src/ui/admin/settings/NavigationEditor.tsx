import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import type { NavigationSettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Button } from '@/ui/components/ui/button'
import { Checkbox } from '@/ui/components/ui/checkbox'
import { Field, FieldLabel } from '@/ui/components/ui/field'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'

interface NavigationEditorProps {
  // Per-section DTO: matches `setting('blog.navigation')`.
  navigation: NavigationSettings
}

interface NavRow {
  text: string
  link: string
  newTab: boolean
}

// React Hook Form's `defaultValues` must be an object — top-level
// arrays end up rendering as `[]` because `watch()` is keyed on the
// top-level object shape. Wrap the rows in `{ rows: NavRow[] }` so the
// form sees a proper FieldValues record.
interface FormState {
  rows: NavRow[]
}

export function NavigationEditor({ navigation }: NavigationEditorProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    NavigationSettings,
    FormState
  >({
    section: 'navigation',
    source: navigation,
    toState: (source) => ({
      rows: source.navigation.map((item) => ({
        text: item.text,
        link: item.link,
        newTab: item.target === '_blank',
      })),
    }),
    fromState: (state) => ({
      navigation: state.rows.map((row) => ({
        text: row.text.trim(),
        link: row.link.trim(),
        ...(row.newTab ? { target: '_blank' } : {}),
      })),
    }),
  })

  const update = (index: number, patch: Partial<NavRow>) =>
    setDraft((prev) => ({
      rows: prev.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }))
  const remove = (index: number) => setDraft((prev) => ({ rows: prev.rows.filter((_, i) => i !== index) }))
  const move = (index: number, direction: -1 | 1) => {
    setDraft((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.rows.length) {
        return prev
      }
      const next = [...prev.rows]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { rows: next }
    })
  }
  const add = () => setDraft((prev) => ({ rows: [...prev.rows, { text: '', link: '/', newTab: false }] }))

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection
        title="导航菜单"
        description="顶部导航条目。顺序、标题、链接均可调整。最多 20 个，链接可以是站内绝对路径或完整外部 URL。"
        groupFields={false}
      >
        <div className="flex flex-col gap-3">
          {draft.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有任何菜单条目，点下方按钮新增一项。</p>
          ) : (
            draft.rows.map((row, index) => (
              <div
                key={index}
                className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-end"
              >
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <div className="flex flex-col gap-1 sm:flex-1">
                    <Label htmlFor={`nav-text-${index}`}>显示文本</Label>
                    <Input
                      id={`nav-text-${index}`}
                      value={row.text}
                      onChange={(e) => update(index, { text: e.target.value })}
                      maxLength={40}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-1">
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
                <div className="flex items-center gap-3">
                  <Field orientation="horizontal" className="w-fit">
                    <Checkbox
                      id={`nav-newtab-${index}`}
                      checked={row.newTab}
                      onCheckedChange={(value) => update(index, { newTab: value === true })}
                    />
                    <FieldLabel htmlFor={`nav-newtab-${index}`} className="font-normal">
                      新窗口打开
                    </FieldLabel>
                  </Field>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="上移"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUpIcon data-icon />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="下移"
                      disabled={index === draft.rows.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDownIcon data-icon />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive-soft"
                      size="icon"
                      aria-label="删除条目"
                      onClick={() => remove(index)}
                    >
                      <Trash2Icon data-icon />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={draft.rows.length >= 20}>
            <PlusIcon data-icon />
            添加菜单项
          </Button>
        </div>
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
