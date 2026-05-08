import { useMemo, useState } from 'react'
import { Form, useNavigation } from 'react-router'

import { Button } from '@/ui/components/ui/button'
import { Combobox, ComboboxContent, ComboboxItem, ComboboxTrigger, ComboboxValue } from '@/ui/components/ui/combobox'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select'

export interface SettingsInstallFormProps {
  token: string
  /**
   * Canonical IANA / tzdata timezone list, supplied by the loader from
   * `getSupportedTimeZones()` (see `@/server/settings/timezones`). The
   * combobox renders verbatim — the schema's `superRefine` rejects
   * anything outside this list at the perimeter.
   */
  timeZones: readonly string[]
}

type AssetScheme = 'http' | 'https'

const SCHEME_OPTIONS: { value: AssetScheme; label: string }[] = [
  { value: 'https', label: 'https' },
  { value: 'http', label: 'http' },
]

interface TimeZoneItem {
  value: string
  label: string
}

const FALLBACK_TIME_ZONE = 'Asia/Shanghai'

// Tries to match the user's environment so the picker defaults to
// something sensible without hard-coding `Asia/Shanghai`. Falls back to
// the project's historical default if `Intl` doesn't surface a zone
// (older browsers, locked-down WebViews) or if the resolved zone is
// somehow not in the supplied list.
function pickInitialZone(timeZones: readonly string[]): string {
  if (typeof Intl !== 'undefined') {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected && timeZones.includes(detected)) {
      return detected
    }
  }
  if (timeZones.includes(FALLBACK_TIME_ZONE)) {
    return FALLBACK_TIME_ZONE
  }
  return timeZones[0] ?? FALLBACK_TIME_ZONE
}

// Mirrors the field grouping used by the post-install settings panels
// and reuses the same shadcn primitives (`Select`, `Combobox`) so the
// install / post-install dropdowns feel identical.
//
// Submission contract: still a plain React Router `<Form method="post">`
// against the route action. Base UI's `Select` / `Combobox` are *not*
// native form fields, so the controlled values are mirrored into hidden
// `<input>`s and the action keeps reading the same field names
// (`assetScheme`, `timeZone`) it always has.
//
// Defaults are deliberate hints, not server-side fallbacks: an admin in
// a hurry can keep `https`, the browser-detected (or `Asia/Shanghai`)
// time zone, and the ISO-flavoured `yyyy-MM-dd HH:mm` token format
// without thinking about them, but the values are still POSTed and
// stored verbatim.
export function SettingsInstallForm({ token, timeZones }: SettingsInstallFormProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting' && navigation.formMethod === 'POST'

  const [assetScheme, setAssetScheme] = useState<AssetScheme>('https')
  const [timeZone, setTimeZone] = useState<string>(() => pickInitialZone(timeZones))

  // Adapt the timezone string list to the `{ value, label }` shape the
  // Base UI Combobox uses for both auto-display and substring filtering.
  const timeZoneItems = useMemo<TimeZoneItem[]>(
    () => timeZones.map((zone) => ({ value: zone, label: zone })),
    [timeZones],
  )
  const selectedTimeZoneItem = useMemo<TimeZoneItem | null>(
    () => timeZoneItems.find((item) => item.value === timeZone) ?? null,
    [timeZoneItems, timeZone],
  )

  return (
    <Form method="post" id="settingsInstallForm" className="flex flex-col gap-6">
      <input type="hidden" name="token" value={token} />
      {/*
       * Hidden mirrors for the two non-native form controls below so the
       * `<Form method="post">` POST body keeps carrying the same field
       * names the route action / Zod schema expect. Plain native inputs
       * (`title`, `website`, `authorEmail`, `assetHost`, `locale`,
       * `timeFormat`) submit themselves and don't need a mirror.
       */}
      <input type="hidden" name="assetScheme" value={assetScheme} />
      <input type="hidden" name="timeZone" value={timeZone} />

      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className="text-sm font-semibold">站点信息</legend>
        <div className="flex flex-col gap-2">
          <Label htmlFor="install-title">站点名称</Label>
          <Input
            id="install-title"
            name="title"
            type="text"
            required
            maxLength={120}
            disabled={isSubmitting}
            placeholder="My Blog"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="install-website">站点 URL</Label>
          <Input
            id="install-website"
            name="website"
            type="url"
            required
            disabled={isSubmitting}
            placeholder="https://example.com"
          />
          <p className="text-xs text-muted-foreground">完整的 https URL，结尾不带斜杠。</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="install-author-email">作者邮箱</Label>
          <Input
            id="install-author-email"
            name="authorEmail"
            type="email"
            required
            disabled={isSubmitting}
            placeholder="hello@example.com"
          />
          <p className="text-xs text-muted-foreground">评论通知 / 待审核提醒发件人，可与管理员邮箱不同。</p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className="text-sm font-semibold">静态资源域名</legend>
        <div className="flex flex-col gap-2">
          <Label htmlFor="install-asset-scheme">协议</Label>
          <Select
            items={SCHEME_OPTIONS}
            value={assetScheme}
            onValueChange={(value) => setAssetScheme(((value as AssetScheme | null) ?? 'https') as AssetScheme)}
            disabled={isSubmitting}
          >
            <SelectTrigger id="install-asset-scheme" className="w-full">
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
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="install-asset-host">CDN 域名</Label>
          <Input
            id="install-asset-host"
            name="assetHost"
            type="text"
            required
            maxLength={253}
            disabled={isSubmitting}
            placeholder="cdn.example.com"
          />
          <p className="text-xs text-muted-foreground">
            必须与部署期 ENV 变量 ASSET_HOST 数值一致：MDX 编译流水线在数据库不可用阶段从 ENV 读取，运行期从这里读取。
          </p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className="text-sm font-semibold">时间与本地化</legend>
        <div className="flex flex-col gap-2">
          <Label htmlFor="install-locale">语言</Label>
          <Input
            id="install-locale"
            name="locale"
            type="text"
            required
            maxLength={35}
            disabled={isSubmitting}
            defaultValue="zh-CN"
            placeholder="zh-CN"
          />
          <p className="text-xs text-muted-foreground">BCP 47 语言标签，例如 zh-CN、en-US。</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="install-timezone">时区</Label>
          {/*
           * Searchable combobox (Base UI handles substring filtering
           * client-side over the full `items` array). Mirrors the
           * comments admin filter dropdowns so install / post-install
           * pickers feel identical.
           */}
          <Combobox<TimeZoneItem>
            items={timeZoneItems}
            value={selectedTimeZoneItem}
            onValueChange={(item) => {
              if (item) {
                setTimeZone(item.value)
              }
            }}
            disabled={isSubmitting}
          >
            <ComboboxTrigger id="install-timezone" className="w-full">
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
          <p className="text-xs text-muted-foreground">
            IANA / tzdata 时区，列表来自当前 Node 运行时的 ICU 数据。默认尝试匹配浏览器自动检测到的时区。
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="install-time-format">日期格式</Label>
          <Input
            id="install-time-format"
            name="timeFormat"
            type="text"
            required
            maxLength={40}
            disabled={isSubmitting}
            defaultValue="yyyy-MM-dd HH:mm"
            placeholder="yyyy-MM-dd HH:mm"
          />
          <p className="text-xs text-muted-foreground">
            遵循 ISO 8601 / Unicode LDML 风格的占位符：yyyy（年）/ MM（月）/ dd（日）/ HH（24 小时制）/ mm（分钟）。
          </p>
        </div>
      </fieldset>

      <Button type="submit" name="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? '初始化中...' : '完成初始化并进入后台'}
      </Button>
    </Form>
  )
}
