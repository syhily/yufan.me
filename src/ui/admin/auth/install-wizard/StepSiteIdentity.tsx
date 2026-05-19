import { XIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { useInstallWizard } from '@/ui/admin/auth/install-wizard/InstallWizardContext'
import { Combobox, ComboboxContent, ComboboxItem, ComboboxTrigger, ComboboxValue } from '@/ui/components/combobox'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

export interface StepProps {
  csrf: string
  timeZones: readonly string[]
}

interface TimeZoneItem {
  value: string
  label: string
}

function parseKeywordsInput(value: string): string[] {
  return value
    .split(/[,，]/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
}

export function StepSiteIdentity({ timeZones }: StepProps) {
  const { data, updateData } = useInstallWizard()

  // Local editing state for keywords so the input feels responsive
  const [keywordInput, setKeywordInput] = useState('')

  const timeZoneItems = useMemo<TimeZoneItem[]>(
    () => timeZones.map((zone) => ({ value: zone, label: zone })),
    [timeZones],
  )

  const selectedTimeZoneItem = useMemo<TimeZoneItem | null>(
    () => timeZoneItems.find((item) => item.value === data.timeZone) ?? null,
    [timeZoneItems, data.timeZone],
  )

  const handleAddKeyword = useCallback(() => {
    const newKeys = parseKeywordsInput(keywordInput)
    if (newKeys.length === 0) {
      return
    }
    updateData((prev) => ({
      ...prev,
      keywords: [...prev.keywords, ...newKeys].filter((k, i, arr) => arr.indexOf(k) === i).slice(0, 20),
    }))
    setKeywordInput('')
  }, [keywordInput, updateData])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-title">站点名称</Label>
        <Input
          id="w-title"
          value={data.title}
          onChange={(e) => updateData((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="My Blog"
          maxLength={120}
          required
        />
        <p className="text-xs text-muted-foreground">已在初始化第一步填写，可在此修改。</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-description">站点描述</Label>
        <Input
          id="w-description"
          value={data.description}
          onChange={(e) => updateData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="一段简短的站点描述"
          maxLength={240}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-website">站点 URL</Label>
        <Input
          id="w-website"
          type="url"
          value={data.website}
          onChange={(e) => updateData((prev) => ({ ...prev, website: e.target.value }))}
          placeholder="https://example.com"
          required
        />
        <p className="text-xs text-muted-foreground">完整的 https URL，结尾不带斜杠。</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-keywords">关键词</Label>
        <div className="flex gap-2">
          <Input
            id="w-keywords"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddKeyword()
              }
            }}
            placeholder="输入关键词，按回车或逗号添加"
            maxLength={60}
          />
        </div>
        {data.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.keywords.map((kw) => (
              <span key={`kw-${kw}`} className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs">
                {kw}
                <button
                  type="button"
                  onClick={() =>
                    updateData((prev) => ({
                      ...prev,
                      keywords: prev.keywords.filter((k) => k !== kw),
                    }))
                  }
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`删除关键词 ${kw}`}
                >
                  <XIcon size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-locale">语言</Label>
          <Input
            id="w-locale"
            value={data.locale}
            onChange={(e) => updateData((prev) => ({ ...prev, locale: e.target.value }))}
            placeholder="zh-CN"
            maxLength={35}
            required
          />
          <p className="text-xs text-muted-foreground">BCP 47 语言标签，例如 zh-CN、en-US。</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-timeformat">日期格式</Label>
          <Input
            id="w-timeformat"
            value={data.timeFormat}
            onChange={(e) => updateData((prev) => ({ ...prev, timeFormat: e.target.value }))}
            placeholder="yyyy-MM-dd HH:mm"
            maxLength={40}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="w-timezone">时区</Label>
        <Combobox<TimeZoneItem>
          items={timeZoneItems}
          value={selectedTimeZoneItem}
          onValueChange={(item) => {
            if (item) {
              updateData((prev) => ({ ...prev, timeZone: item.value }))
            }
          }}
        >
          <ComboboxTrigger id="w-timezone" className="w-full">
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
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-initialyear">起始年份</Label>
          <Input
            id="w-initialyear"
            type="number"
            value={data.initialYear}
            onChange={(e) => updateData((prev) => ({ ...prev, initialYear: Number(e.target.value) }))}
            min={1970}
            max={9999}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-icp">备案号（可选）</Label>
          <Input
            id="w-icp"
            value={data.icpNo ?? ''}
            onChange={(e) => updateData((prev) => ({ ...prev, icpNo: e.target.value || undefined }))}
            placeholder="京ICP备xxx号"
            maxLength={60}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="w-moeicp">公安备案号（可选）</Label>
          <Input
            id="w-moeicp"
            value={data.moeIcpNo ?? ''}
            onChange={(e) => updateData((prev) => ({ ...prev, moeIcpNo: e.target.value || undefined }))}
            placeholder="京公网安备xxx号"
            maxLength={60}
          />
        </div>
      </div>
    </div>
  )
}
