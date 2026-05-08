import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useMemo } from 'react'

import type { SocialsSettings } from '@/shared/config/blog'

import { type SocialNetwork, SOCIAL_NETWORK_META, SOCIAL_NETWORKS, getSocialNetworkMeta } from '@/shared/config/socials'
import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Button } from '@/ui/components/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/components/dropdown-menu'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'
import { SOCIAL_NETWORK_ICONS } from '@/ui/icons/social-icons'

interface SocialsEditorProps {
  // Per-section DTO: matches `setting('blog.socials')`.
  socials: SocialsSettings
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

// React Hook Form's `defaultValues` must be an object — top-level
// arrays end up rendering as `[]` because `watch()` is keyed on the
// top-level object shape. Wrap the rows in `{ rows: SocialRow[] }` so
// the form sees a proper FieldValues record.
interface FormState {
  rows: SocialRow[]
}

export function SocialsEditor({ socials }: SocialsEditorProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    SocialsSettings,
    FormState
  >({
    section: 'socials',
    source: socials,
    toState: (source) => {
      // Drop entries whose `network` is unknown to the closed list — older
      // DB rows from before the canonical metadata existed (or rows that
      // somehow drifted out of sync) would otherwise wedge the editor with
      // a row it can't render.
      const seen = new Set<SocialNetwork>()
      const rows: SocialRow[] = []
      for (const item of source.socials) {
        if (!(SOCIAL_NETWORKS as readonly string[]).includes(item.network)) {
          continue
        }
        if (seen.has(item.network)) {
          continue
        }
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
      return { rows }
    },
    fromState: (state) => ({
      socials: state.rows.map((row) => {
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
    }),
  })

  const usedNetworks = useMemo(() => new Set(draft.rows.map((row) => row.network)), [draft.rows])
  const availableNetworks = useMemo(
    () => SOCIAL_NETWORKS.filter((network) => !usedNetworks.has(network)),
    [usedNetworks],
  )

  const update = (index: number, patch: Partial<SocialRow>) =>
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
  const addNetwork = (network: SocialNetwork) =>
    setDraft((prev) =>
      prev.rows.some((row) => row.network === network)
        ? prev
        : { rows: [...prev.rows, { network, name: '', title: '', link: '' }] },
    )

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection
        title="社交链接"
        description="Header 右侧的社交账号入口。每个社交平台只能添加一条；展示方式（直接外跳 / 二维码弹窗）由平台决定，不可手动切换。"
        groupFields={false}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="outline" size="sm" disabled={availableNetworks.length === 0}>
                  <PlusIcon data-icon />
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
                  const Icon = SOCIAL_NETWORK_ICONS[network]
                  return (
                    <DropdownMenuItem key={network} onClick={() => addNetwork(network)}>
                      <Icon />
                      <span>{meta.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
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
        <div className="flex flex-col gap-3">
          {draft.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有任何社交链接，点右上角按钮挑一个平台开始。</p>
          ) : (
            draft.rows.map((row, index) => {
              const meta = getSocialNetworkMeta(row.network)
              const Icon = SOCIAL_NETWORK_ICONS[row.network]
              return (
                <div key={row.network} className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-md border bg-background text-foreground [&_svg]:size-4">
                        <Icon />
                      </span>
                      <div className="flex flex-col leading-tight">
                        <span className="text-sm font-medium">{meta.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {meta.type === 'qrcode' ? '点击 Header 图标会弹出二维码' : '点击 Header 图标会直接外跳链接'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
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
                        aria-label={`删除「${meta.label}」`}
                        onClick={() => remove(index)}
                      >
                        <Trash2Icon data-icon />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Label htmlFor={`social-name-${row.network}`}>用户名（可选）</Label>
                    <Input
                      id={`social-name-${row.network}`}
                      value={row.name}
                      onChange={(e) => update(index, { name: e.target.value })}
                      maxLength={60}
                      placeholder={meta.defaultName}
                    />
                    <p className="text-xs text-muted-foreground">
                      {meta.type === 'qrcode'
                        ? `二维码弹窗标题下方的小字。留空则显示平台名「${meta.defaultName}」。`
                        : `Header 图标的鼠标悬停提示。留空则显示平台名「${meta.defaultName}」。`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
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
                    <div className="flex flex-col gap-3">
                      <Label htmlFor={`social-title-${row.network}`}>二维码弹窗标题（可选）</Label>
                      <Input
                        id={`social-title-${row.network}`}
                        value={row.title}
                        onChange={(e) => update(index, { title: e.target.value })}
                        maxLength={120}
                        placeholder={`扫码加我${meta.label}好友`}
                      />
                      <p className="text-xs text-muted-foreground">弹窗顶部的大标题。留空则只显示用户名 / 平台名。</p>
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
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
