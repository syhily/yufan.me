import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { type ComponentType, type SubmitEventHandler, useCallback, useEffect, useMemo, useState } from 'react'

import type { BlogSettings } from '@/shared/blog-config'

import { type SocialNetwork, SOCIAL_NETWORK_META, SOCIAL_NETWORKS, getSocialNetworkMeta } from '@/shared/socials'
import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsFetcher } from '@/ui/admin/settings/useSettingsFetcher'
import { Button } from '@/ui/admin/shadcn/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/admin/shadcn/components/ui/dropdown-menu'
import { Input } from '@/ui/admin/shadcn/components/ui/input'
import { Label } from '@/ui/admin/shadcn/components/ui/label'
import { GithubFillIcon, type IconProps, QqIcon, TwitterIcon, WechatIcon, WeiboIcon } from '@/ui/icons/icons'

interface SocialsEditorProps {
  settings: BlogSettings
  csrfToken: string
}

interface SocialRow {
  network: SocialNetwork
  /**
   * Optional account display name. For QR rows it shows under the popup
   * heading (e.g. "Yufan Sheng"); for link rows it becomes the `<a>`
   * tooltip. Empty falls back to the platform's default name on save.
   */
  name: string
  /** Editable QR popup heading; ignored for `link` rows. */
  title: string
  link: string
}

// Local mirror of `SocialNetwork → icon` so the editor can show the same
// brand mark the public Header would render. Mirrors the switch in
// `@/ui/primitives/Header`; new platforms must be added in both places
// (no string-based icon lookup per `bundle-analyzable-paths`).
const NETWORK_ICONS: Record<SocialNetwork, ComponentType<IconProps>> = {
  github: GithubFillIcon,
  twitter: TwitterIcon,
  wechat: WechatIcon,
  weibo: WeiboIcon,
  qq: QqIcon,
}

function snapshotFromSettings(settings: BlogSettings): SocialRow[] {
  // Drop entries whose `network` is unknown to the closed list — older
  // DB rows from before the canonical metadata existed (or rows that
  // somehow drifted out of sync) would otherwise wedge the editor with
  // a row it can't render.
  const seen = new Set<SocialNetwork>()
  const rows: SocialRow[] = []
  for (const item of settings.socials) {
    if (!(SOCIAL_NETWORKS as readonly string[]).includes(item.network)) continue
    if (seen.has(item.network)) continue
    seen.add(item.network)
    // Hide the platform-default name in the editor: it's the "did the
    // editor type anything?" sentinel we use on save to decide whether
    // to persist `name` at all. If a future deploy renames the default,
    // rows that historically inherited it will still inherit the new
    // value rather than freezing the old one in place.
    const meta = getSocialNetworkMeta(item.network)
    const customName = item.name && item.name !== meta.defaultName ? item.name : ''
    rows.push({ network: item.network, name: customName, title: item.title ?? '', link: item.link })
  }
  return rows
}

function rowsEqual(a: SocialRow[], b: SocialRow[]): boolean {
  if (a.length !== b.length) return false
  return a.every((row, index) => {
    const other = b[index]
    return (
      row.network === other.network && row.name === other.name && row.title === other.title && row.link === other.link
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
  const usedNetworks = useMemo(() => new Set(draft.map((row) => row.network)), [draft])
  const availableNetworks = useMemo(
    () => SOCIAL_NETWORKS.filter((network) => !usedNetworks.has(network)),
    [usedNetworks],
  )

  const onSaved = useCallback(() => setSnapshot(draft), [draft])
  const { save, isPending, status, errorMessage } = useSettingsFetcher({
    section: 'socials',
    onSaved,
  })

  const onSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    save({
      socials: draft.map((row) => {
        const meta = getSocialNetworkMeta(row.network)
        const customName = row.name.trim()
        return {
          name: customName || meta.defaultName,
          network: row.network,
          type: meta.type,
          ...(meta.type === 'qrcode' && row.title.trim() ? { title: row.title.trim() } : {}),
          link: row.link.trim(),
        }
      }),
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
  const addNetwork = (network: SocialNetwork) =>
    setDraft((prev) =>
      prev.some((row) => row.network === network) ? prev : [...prev, { network, name: '', title: '', link: '' }],
    )

  return (
    <form onSubmit={onSubmit} className="tw:flex tw:flex-col tw:gap-6">
      <SettingsSection
        title="社交链接"
        description="Header 右侧的社交账号入口。每个社交平台只能添加一条；展示方式（直接外跳 / 二维码弹窗）由平台决定，不可手动切换。"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="outline" size="sm" disabled={availableNetworks.length === 0}>
                  <PlusIcon className="tw:size-4" />
                  添加社交链接
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {availableNetworks.length === 0 ? (
                <DropdownMenuItem disabled>所有平台都已添加</DropdownMenuItem>
              ) : (
                availableNetworks.map((network) => {
                  const meta = SOCIAL_NETWORK_META[network]
                  const Icon = NETWORK_ICONS[network]
                  return (
                    <DropdownMenuItem key={network} onClick={() => addNetwork(network)}>
                      <Icon className="tw:size-4" />
                      <span>{meta.label}</span>
                      <span className="tw:text-muted-foreground tw:ml-auto tw:text-xs">
                        {meta.type === 'qrcode' ? '二维码' : '链接'}
                      </span>
                    </DropdownMenuItem>
                  )
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <div className="tw:flex tw:flex-col tw:gap-3">
          {draft.length === 0 ? (
            <p className="tw:text-muted-foreground tw:text-sm">还没有任何社交链接，点右上角按钮挑一个平台开始。</p>
          ) : (
            draft.map((row, index) => {
              const meta = getSocialNetworkMeta(row.network)
              const Icon = NETWORK_ICONS[row.network]
              return (
                <div
                  key={row.network}
                  className="tw:bg-muted/30 tw:flex tw:flex-col tw:gap-3 tw:rounded-md tw:border tw:p-3"
                >
                  <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
                    <div className="tw:flex tw:items-center tw:gap-2">
                      <span className="tw:bg-background tw:text-foreground tw:flex tw:size-8 tw:items-center tw:justify-center tw:rounded-md tw:border">
                        <Icon className="tw:size-4" />
                      </span>
                      <div className="tw:flex tw:flex-col tw:leading-tight">
                        <span className="tw:text-sm tw:font-medium">{meta.label}</span>
                        <span className="tw:text-muted-foreground tw:text-xs">
                          {meta.type === 'qrcode' ? '点击 Header 图标会弹出二维码' : '点击 Header 图标会直接外跳链接'}
                        </span>
                      </div>
                    </div>
                    <div className="tw:flex tw:items-center tw:gap-1">
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
                        aria-label={`删除「${meta.label}」`}
                        onClick={() => remove(index)}
                      >
                        <Trash2Icon className="tw:size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="tw:flex tw:flex-col tw:gap-3">
                    <Label htmlFor={`social-name-${row.network}`}>用户名（可选）</Label>
                    <Input
                      id={`social-name-${row.network}`}
                      value={row.name}
                      onChange={(e) => update(index, { name: e.target.value })}
                      maxLength={60}
                      placeholder={meta.defaultName}
                    />
                    <p className="tw:text-muted-foreground tw:text-xs">
                      {meta.type === 'qrcode'
                        ? `二维码弹窗标题下方的小字。留空则显示平台名「${meta.defaultName}」。`
                        : `Header 图标的鼠标悬停提示。留空则显示平台名「${meta.defaultName}」。`}
                    </p>
                  </div>
                  <div className="tw:flex tw:flex-col tw:gap-3">
                    <Label htmlFor={`social-link-${row.network}`}>{meta.linkLabel}</Label>
                    <Input
                      id={`social-link-${row.network}`}
                      value={row.link}
                      onChange={(e) => update(index, { link: e.target.value })}
                      placeholder={meta.linkPlaceholder}
                      required
                    />
                  </div>
                  {meta.type === 'qrcode' ? (
                    <div className="tw:flex tw:flex-col tw:gap-3">
                      <Label htmlFor={`social-title-${row.network}`}>二维码弹窗标题（可选）</Label>
                      <Input
                        id={`social-title-${row.network}`}
                        value={row.title}
                        onChange={(e) => update(index, { title: e.target.value })}
                        maxLength={120}
                        placeholder={`扫码加我${meta.label}好友`}
                      />
                      <p className="tw:text-muted-foreground tw:text-xs">
                        弹窗顶部的大标题。留空则只显示用户名 / 平台名。
                      </p>
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </SettingsSection>

      <SettingsFormBar isPending={isPending} isDirty={isDirty} status={status} errorMessage={errorMessage} />
    </form>
  )
}
