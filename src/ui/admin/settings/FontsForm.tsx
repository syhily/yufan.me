import { PlusIcon, Trash2Icon } from 'lucide-react'

import type { FontsSettings } from '@/shared/config/blog'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Button } from '@/ui/components/button'
import { Input } from '@/ui/components/input'

// Local form mirror: the wire shape matches `FontsSettings` 1:1 — no
// secrets, no derived fields — so we keep the same names. The
// `globalCss` / `postCss` arrays carry a stable client-side row id
// alongside the URL so React `key` survives reorder / delete (same
// pattern as `NavigationEditor`).
interface CssRow {
  clientId: string
  url: string
}

interface FormState {
  ogUrl: string
  calendarUrl: string
  globalCss: CssRow[]
  postCss: CssRow[]
}

interface FontsFormProps {
  fonts: FontsSettings
}

export function FontsForm({ fonts }: FontsFormProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    FontsSettings,
    FormState
  >({
    section: 'fonts',
    source: fonts,
    toState: (source) => ({
      ogUrl: source.og.url,
      calendarUrl: source.calendar.url,
      globalCss: source.globalCss.map((url) => ({ clientId: crypto.randomUUID(), url })),
      postCss: source.postCss.map((url) => ({ clientId: crypto.randomUUID(), url })),
    }),
    fromState: (state) => ({
      og: { url: state.ogUrl.trim() },
      calendar: { url: state.calendarUrl.trim() },
      // Trim then drop empty rows — operators sometimes leave a half-
      // edited blank input behind; we don't want it persisting.
      globalCss: state.globalCss.map((row) => row.url.trim()).filter((url) => url !== ''),
      postCss: state.postCss.map((row) => row.url.trim()).filter((url) => url !== ''),
    }),
  })

  function updateRow(slot: 'globalCss' | 'postCss', clientId: string, url: string) {
    setDraft((prev) => ({
      ...prev,
      [slot]: prev[slot].map((row) => (row.clientId === clientId ? { ...row, url } : row)),
    }))
  }
  function removeRow(slot: 'globalCss' | 'postCss', clientId: string) {
    setDraft((prev) => ({ ...prev, [slot]: prev[slot].filter((row) => row.clientId !== clientId) }))
  }
  function addRow(slot: 'globalCss' | 'postCss') {
    setDraft((prev) => ({ ...prev, [slot]: [...prev[slot], { clientId: crypto.randomUUID(), url: '' }] }))
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection
        title="Canvas 字体"
        description="服务端渲染 OG 图与日历图时使用的字体。必须是 TTF / OTF 格式（@napi-rs/canvas 通过 FreeType 解析，不支持 WOFF / WOFF2）。下载后的 Buffer 会缓存到 Redis 与进程内存，重启或缓存清空后下次冷启动会重新下载。留空时降级使用系统中文字体。"
      >
        <SettingsRow
          label="OG 图字体 URL"
          htmlFor="fonts-og-url"
          hint="例如 https://cat.yufan.me/fonts-src/opposans.ttf"
        >
          <Input
            id="fonts-og-url"
            type="url"
            value={draft.ogUrl}
            onChange={(e) => setDraft((prev) => ({ ...prev, ogUrl: e.target.value }))}
            placeholder="https://..."
            maxLength={500}
          />
        </SettingsRow>

        <SettingsRow
          label="日历图字体 URL"
          htmlFor="fonts-calendar-url"
          hint="例如 https://cat.yufan.me/fonts-src/opposerif.ttf"
        >
          <Input
            id="fonts-calendar-url"
            type="url"
            value={draft.calendarUrl}
            onChange={(e) => setDraft((prev) => ({ ...prev, calendarUrl: e.target.value }))}
            placeholder="https://..."
            maxLength={500}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="全站字体 CSS"
        description="每个 URL 都会在所有页面的 <head> 注入一个 <link rel='stylesheet'>。通常放 body 字体（如 OPPO Sans）与代码字体（如 Iosevka）的 @font-face CSS。CSS 文件本身可由 cn-font-split 离线生成、上传到任意 CDN。"
      >
        <CssUrlList
          slot="globalCss"
          rows={draft.globalCss}
          onChange={(clientId, url) => updateRow('globalCss', clientId, url)}
          onRemove={(clientId) => removeRow('globalCss', clientId)}
          onAdd={() => addRow('globalCss')}
        />
      </SettingsSection>

      <SettingsSection
        title="文章页字体 CSS"
        description="仅在文章详情页（/posts/:slug、/:slug）的 <head> 注入。适合体积大、仅长文阅读需要的字体（如 OPPO Serif）。其他路由（首页、归档、Admin、错误页等）不会加载这些 CSS。"
      >
        <CssUrlList
          slot="postCss"
          rows={draft.postCss}
          onChange={(clientId, url) => updateRow('postCss', clientId, url)}
          onRemove={(clientId) => removeRow('postCss', clientId)}
          onAdd={() => addRow('postCss')}
        />
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

interface CssUrlListProps {
  slot: 'globalCss' | 'postCss'
  rows: CssRow[]
  onChange: (clientId: string, url: string) => void
  onRemove: (clientId: string) => void
  onAdd: () => void
}

function CssUrlList({ slot, rows, onChange, onRemove, onAdd }: CssUrlListProps) {
  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">还没有添加 CSS，点击下方按钮新增一项。</p>
      ) : (
        rows.map((row) => (
          <div key={row.clientId} className="flex items-center gap-2">
            <Input
              type="url"
              value={row.url}
              onChange={(e) => onChange(row.clientId, e.target.value)}
              placeholder="https://cat.yufan.me/fonts/<name>.css"
              maxLength={500}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(row.clientId)}
              aria-label="删除此项"
            >
              <Trash2Icon className="text-destructive" />
            </Button>
          </div>
        ))
      )}
      <div>
        <Button type="button" variant="outline" size="sm" disabled={rows.length >= 8} onClick={onAdd}>
          <PlusIcon />
          {slot === 'globalCss' ? '添加全站 CSS' : '添加文章页 CSS'}
        </Button>
        {rows.length >= 8 && <span className="ml-2 text-xs text-muted-foreground">上限 8 条</span>}
      </div>
    </div>
  )
}
