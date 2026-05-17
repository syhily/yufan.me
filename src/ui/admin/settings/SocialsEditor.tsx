import type { SocialsSettings } from '@/shared/config/blog'

import { type SocialNetwork, SOCIAL_NETWORKS, getSocialNetworkMeta } from '@/shared/config/socials'
import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
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
      const sourceMap = new Map(source.socials.map((s) => [s.network, s]))
      const rows: SocialRow[] = SOCIAL_NETWORKS.map((network) => {
        const item = sourceMap.get(network)
        const meta = getSocialNetworkMeta(network)
        if (item) {
          const customName = item.name && item.name !== meta.defaultName ? item.name : ''
          return { network, name: customName, title: item.title ?? '', link: item.link }
        }
        return { network, name: '', title: '', link: '' }
      })
      return { rows }
    },
    fromState: (state) => ({
      socials: state.rows
        .filter((row) => row.link.trim() !== '')
        .map((row) => {
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

  const update = (index: number, patch: Partial<SocialRow>) =>
    setDraft((prev) => ({
      rows: prev.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }))

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection
        title="社交链接"
        description="配置各社交平台的账号或二维码。填写链接后平台即生效，留空则不在网站展示。展示顺序由底部导航菜单控制。"
        groupFields={false}
      >
        <div className="flex flex-col gap-3">
          {draft.rows.map((row, index) => {
            const meta = getSocialNetworkMeta(row.network)
            const Icon = SOCIAL_NETWORK_ICONS[row.network]
            return (
              <div key={row.network} className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-md border bg-background text-foreground [&_svg]:size-4">
                    <Icon />
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-medium">{meta.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {meta.type === 'qrcode' ? '点击图标会弹出二维码' : '点击图标会直接外跳链接'}
                    </span>
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
                      : `图标的鼠标悬停提示。留空则显示平台名「${meta.defaultName}」。`}
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Label htmlFor={`social-link-${row.network}`}>{meta.linkLabel}</Label>
                  <Input
                    id={`social-link-${row.network}`}
                    value={row.link}
                    onChange={(e) => update(index, { link: e.target.value })}
                    placeholder={meta.linkPlaceholder}
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
          })}
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
