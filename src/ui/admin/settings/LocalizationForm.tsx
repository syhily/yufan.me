import { type SubmitEventHandler, useCallback, useEffect, useMemo, useState } from 'react'

import type { BlogSettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { FieldRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsFetcher } from '@/ui/admin/settings/useSettingsFetcher'
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxTrigger,
  ComboboxValue,
} from '@/ui/admin/shadcn/components/ui/combobox'
import { Input } from '@/ui/admin/shadcn/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/admin/shadcn/components/ui/select'

interface TimeZoneItem {
  value: string
  label: string
}

interface LocalizationFormProps {
  settings: BlogSettings
  csrfToken: string
  /**
   * Canonical IANA timezone list. Resolved by the parent layout loader
   * via `getSupportedTimeZones()` so this UI module stays in the
   * client-safe `@/ui/*` layer (no server import).
   */
  timeZones: readonly string[]
}

interface FormState {
  assetHost: string
  assetScheme: 'http' | 'https'
  locale: string
  timeZone: string
  timeFormat: string
}

const SCHEME_OPTIONS: { value: FormState['assetScheme']; label: string }[] = [
  { value: 'https', label: 'https' },
  { value: 'http', label: 'http' },
]

function snapshotFromSettings(settings: BlogSettings): FormState {
  return {
    assetHost: settings.settings.asset.host,
    assetScheme: settings.settings.asset.scheme,
    locale: settings.settings.locale,
    timeZone: settings.settings.timeZone,
    timeFormat: settings.settings.timeFormat,
  }
}

function statesEqual(a: FormState, b: FormState): boolean {
  return (
    a.assetHost === b.assetHost &&
    a.assetScheme === b.assetScheme &&
    a.locale === b.locale &&
    a.timeZone === b.timeZone &&
    a.timeFormat === b.timeFormat
  )
}

export function LocalizationForm({ settings, csrfToken: _csrfToken, timeZones }: LocalizationFormProps) {
  const [snapshot, setSnapshot] = useState<FormState>(() => snapshotFromSettings(settings))
  const [draft, setDraft] = useState<FormState>(snapshot)

  // Adapt the canonical IANA list to Base UI Combobox's `{ value,
  // label }` contract. The transformation is cheap (~400 entries) but
  // memoised so the Combobox does not see a fresh array reference on
  // every keystroke and re-derive its filter state.
  const timeZoneItems = useMemo<TimeZoneItem[]>(
    () => timeZones.map((zone) => ({ value: zone, label: zone })),
    [timeZones],
  )
  const selectedTimeZoneItem = useMemo<TimeZoneItem | null>(
    () => timeZoneItems.find((item) => item.value === draft.timeZone) ?? null,
    [timeZoneItems, draft.timeZone],
  )

  useEffect(() => {
    const fresh = snapshotFromSettings(settings)
    setSnapshot(fresh)
    setDraft(fresh)
  }, [settings])

  const isDirty = !statesEqual(draft, snapshot)

  const onSaved = useCallback(() => {
    setSnapshot(draft)
  }, [draft])

  const { save, isPending, status, errorMessage } = useSettingsFetcher({
    section: 'localization',
    onSaved,
  })

  const onSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    save({
      asset: {
        host: draft.assetHost.trim(),
        scheme: draft.assetScheme,
      },
      locale: draft.locale.trim(),
      timeZone: draft.timeZone.trim(),
      timeFormat: draft.timeFormat.trim(),
    })
  }

  return (
    <form onSubmit={onSubmit} className="tw:flex tw:flex-col tw:gap-6">
      <SettingsSection
        title="静态资源域名"
        description="图片 / 音乐 / 头像等远程资源的 CDN 域名。运行期 SSR + 客户端从此处读取。注意：MDX 编译流水线和 sync-image-metadata CLI 在数据库不可用的构建期阶段读取 ASSET_HOST / ASSET_SCHEME 环境变量，请确保两边数值一致。"
      >
        <FieldRow label="协议" htmlFor="loc-asset-scheme">
          <Select
            items={SCHEME_OPTIONS}
            value={draft.assetScheme}
            onValueChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                assetScheme: (value ?? 'https') as FormState['assetScheme'],
              }))
            }
          >
            <SelectTrigger id="loc-asset-scheme" className="tw:w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow
          label="域名"
          htmlFor="loc-asset-host"
          hint="只能包含字母 / 数字 / `-` / `.`，例如 `cat.example.com`。"
        >
          <Input
            id="loc-asset-host"
            value={draft.assetHost}
            onChange={(e) => setDraft((prev) => ({ ...prev, assetHost: e.target.value }))}
            required
            maxLength={253}
            placeholder="cat.example.com"
          />
        </FieldRow>
      </SettingsSection>

      <SettingsSection
        title="时间与本地化"
        description="影响日期格式化函数（formatLocalDate / formatShowDate）以及 OG 图、邮件模板等所有依赖时区的渲染分支。"
      >
        <FieldRow label="语言" htmlFor="loc-locale" hint="BCP 47 语言标签，例如 zh-CN、en-US。">
          <Input
            id="loc-locale"
            value={draft.locale}
            onChange={(e) => setDraft((prev) => ({ ...prev, locale: e.target.value }))}
            required
            maxLength={35}
            placeholder="zh-CN"
          />
        </FieldRow>
        <FieldRow
          label="时区"
          htmlFor="loc-timezone"
          hint="IANA / tzdata 时区，输入关键字过滤。列表由当前 Node 运行时的 ICU 数据提供。"
        >
          {/*
           * Searchable combobox — same primitive the comments admin
           * page uses for its "筛选文章 / 筛选评论人员" filters, so the
           * picker behaviour stays consistent across the admin
           * surface. Base UI handles substring filtering against
           * `items` client-side; no fetcher needed because the full
           * tzdata list is small and already on the wire.
           */}
          <Combobox<TimeZoneItem>
            items={timeZoneItems}
            value={selectedTimeZoneItem}
            onValueChange={(item) => {
              if (item) setDraft((prev) => ({ ...prev, timeZone: item.value }))
            }}
          >
            <ComboboxTrigger id="loc-timezone" className="tw:w-full">
              <ComboboxValue placeholder="搜索 IANA 时区…" />
            </ComboboxTrigger>
            <ComboboxContent<TimeZoneItem> inputPlaceholder="搜索 IANA 时区…" emptyMessage="无匹配时区">
              {(item) => (
                <ComboboxItem key={item.value} value={item}>
                  {item.label}
                </ComboboxItem>
              )}
            </ComboboxContent>
          </Combobox>
        </FieldRow>
        <FieldRow
          label="日期格式"
          htmlFor="loc-time-format"
          hint="支持 yyyy / LL / MM / dd / HH / mm 占位符，例如 yyyy-LL-dd HH:mm。"
        >
          <Input
            id="loc-time-format"
            value={draft.timeFormat}
            onChange={(e) => setDraft((prev) => ({ ...prev, timeFormat: e.target.value }))}
            required
            maxLength={40}
            placeholder="yyyy-LL-dd HH:mm"
          />
        </FieldRow>
      </SettingsSection>

      <SettingsFormBar isPending={isPending} isDirty={isDirty} status={status} errorMessage={errorMessage} />
    </form>
  )
}
