import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { type SubmitEventHandler, useCallback, useEffect, useState } from 'react'

import type { BlogSettings } from '@/server/settings/defaults'

import { type SocialNetwork, SOCIAL_NETWORKS } from '@/shared/socials'
import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsFetcher } from '@/ui/admin/settings/useSettingsFetcher'
import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { Input } from '@/ui/admin/shadcn/components/ui/input'
import { Label } from '@/ui/admin/shadcn/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/admin/shadcn/components/ui/select'

interface SocialsEditorProps {
  settings: BlogSettings
  csrfToken: string
}

interface SocialRow {
  name: string
  network: SocialNetwork
  type: 'link' | 'qrcode'
  title: string
  link: string
}

const NETWORK_OPTIONS: { value: SocialNetwork; label: string }[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'wechat', label: '微信' },
  { value: 'weibo', label: '微博' },
  { value: 'qq', label: 'QQ' },
]

const NETWORK_OPTION_ITEMS = NETWORK_OPTIONS.map((option) => ({ value: option.value, label: option.label }))
const TYPE_ITEMS = [
  { value: 'link', label: '链接（外跳）' },
  { value: 'qrcode', label: '二维码（弹出）' },
]

function snapshotFromSettings(settings: BlogSettings): SocialRow[] {
  return settings.socials.map((item) => ({
    name: item.name,
    network: SOCIAL_NETWORKS.includes(item.network) ? item.network : 'github',
    type: item.type,
    title: item.title ?? '',
    link: item.link,
  }))
}

function rowsEqual(a: SocialRow[], b: SocialRow[]): boolean {
  if (a.length !== b.length) return false
  return a.every((row, index) => {
    const other = b[index]
    return (
      row.name === other.name &&
      row.network === other.network &&
      row.type === other.type &&
      row.title === other.title &&
      row.link === other.link
    )
  })
}

export function SocialsEditor({ settings, csrfToken: _csrfToken }: SocialsEditorProps) {
  const [snapshot, setSnapshot] = useState<SocialRow[]>(() => snapshotFromSettings(settings))
  const [draft, setDraft] = useState<SocialRow[]>(snapshot)

  useEffect(() => {
    const fresh = snapshotFromSettings(settings)
    setSnapshot(fresh)
    setDraft(fresh)
  }, [settings])

  const isDirty = !rowsEqual(draft, snapshot)

  const onSaved = useCallback(() => setSnapshot(draft), [draft])
  const { save, reset, isPending, status, errorMessage } = useSettingsFetcher({
    section: 'socials',
    onSaved,
  })

  const onSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    save({
      socials: draft.map((row) => ({
        name: row.name.trim(),
        network: row.network,
        type: row.type,
        ...(row.title.trim() ? { title: row.title.trim() } : {}),
        link: row.link.trim(),
      })),
    })
  }

  const update = (index: number, patch: Partial<SocialRow>) =>
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
  const add = () => setDraft((prev) => [...prev, { name: '', network: 'github', type: 'link', title: '', link: '' }])

  return (
    <form onSubmit={onSubmit} className="tw:flex tw:flex-col tw:gap-6">
      <SettingsSection
        title="社交链接"
        description="Header 右侧的社交账号入口。type=link 直接外跳；type=qrcode 会在弹窗里展示一张由 link 生成的二维码。"
      >
        <div className="tw:flex tw:flex-col tw:gap-3">
          {draft.length === 0 ? (
            <p className="tw:text-muted-foreground tw:text-sm">还没有任何社交链接，点下方按钮新增。</p>
          ) : (
            draft.map((row, index) => (
              <div key={index} className="tw:bg-muted/30 tw:flex tw:flex-col tw:gap-3 tw:rounded-md tw:border tw:p-3">
                <div className="tw:grid tw:gap-3 tw:sm:grid-cols-2">
                  <div className="tw:flex tw:flex-col tw:gap-1">
                    <Label htmlFor={`social-name-${index}`}>显示名</Label>
                    <Input
                      id={`social-name-${index}`}
                      value={row.name}
                      onChange={(e) => update(index, { name: e.target.value })}
                      maxLength={60}
                      required
                    />
                  </div>
                  <div className="tw:flex tw:flex-col tw:gap-1">
                    <Label htmlFor={`social-network-${index}`}>平台 / 图标</Label>
                    <Select
                      value={row.network}
                      items={NETWORK_OPTION_ITEMS}
                      onValueChange={(value) => update(index, { network: (value ?? 'github') as SocialNetwork })}
                    >
                      <SelectTrigger id={`social-network-${index}`} className="tw:w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NETWORK_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="tw:grid tw:gap-3 tw:sm:grid-cols-[1fr_2fr]">
                  <div className="tw:flex tw:flex-col tw:gap-1">
                    <Label htmlFor={`social-type-${index}`}>展示方式</Label>
                    <Select
                      value={row.type}
                      items={TYPE_ITEMS}
                      onValueChange={(value) => update(index, { type: (value ?? 'link') as 'link' | 'qrcode' })}
                    >
                      <SelectTrigger id={`social-type-${index}`} className="tw:w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_ITEMS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="tw:flex tw:flex-col tw:gap-1">
                    <Label htmlFor={`social-link-${index}`}>链接 / 二维码内容</Label>
                    <Input
                      id={`social-link-${index}`}
                      value={row.link}
                      onChange={(e) => update(index, { link: e.target.value })}
                      placeholder="https://example.com"
                      required
                    />
                  </div>
                </div>
                {row.type === 'qrcode' ? (
                  <div className="tw:flex tw:flex-col tw:gap-1">
                    <Label htmlFor={`social-title-${index}`}>二维码弹窗标题（可选）</Label>
                    <Input
                      id={`social-title-${index}`}
                      value={row.title}
                      onChange={(e) => update(index, { title: e.target.value })}
                      maxLength={120}
                      placeholder="扫码加我微信好友"
                    />
                  </div>
                ) : null}
                <div className="tw:flex tw:items-center tw:justify-end tw:gap-1">
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
                    aria-label="删除社交链接"
                    onClick={() => remove(index)}
                  >
                    <Trash2Icon className="tw:size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={draft.length >= 20}>
            <PlusIcon className="tw:size-4" />
            添加社交链接
          </Button>
        </div>
      </SettingsSection>

      <SettingsFormBar
        isPending={isPending}
        isDirty={isDirty}
        status={status}
        errorMessage={errorMessage}
        onReset={reset}
      />
    </form>
  )
}
