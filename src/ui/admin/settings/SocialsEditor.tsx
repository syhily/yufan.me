import type { SocialsSettings } from '@/shared/config/blog'

import { type SocialNetwork, SOCIAL_NETWORKS, getSocialNetworkMeta } from '@/shared/config/socials'
import { GhostSettingGroup } from '@/ui/admin/settings-ghost/GhostSettingGroup'
import { GhostSettingValue } from '@/ui/admin/settings-ghost/GhostSettingValue'
import { useSettingsCard } from '@/ui/admin/settings-ghost/useSettingsCard'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'
import { SOCIAL_NETWORK_ICONS } from '@/ui/icons/social-icons'

interface SocialsEditorProps {
  socials: SocialsSettings
}

interface SocialRow {
  network: SocialNetwork
  name: string
  title: string
  link: string
}

function toFormState(source: SocialsSettings): { rows: SocialRow[] } {
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
}

export function SocialsEditor({ socials }: SocialsEditorProps) {
  const { isEditing, setIsEditing, form, save, cancel, status, errorMessage } = useSettingsCard<
    SocialsSettings,
    { rows: SocialRow[] }
  >({
    section: 'socials',
    source: socials,
    toState: toFormState,
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

  const rows = form.watch('rows')

  const update = (index: number, patch: Partial<SocialRow>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    form.setValue('rows', next)
  }

  return (
    <GhostSettingGroup
      title="社交链接"
      description="配置各社交平台的账号或二维码。填写链接后平台即生效，留空则不在网站展示。"
      isEditing={isEditing}
      onEditingChange={setIsEditing}
      onSave={save}
      onCancel={cancel}
      saveState={status}
      errorMessage={errorMessage}
    >
      {isEditing ? (
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => {
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
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {socials.socials.length === 0 ? (
            <p className="text-sm text-muted-foreground">未配置任何社交链接</p>
          ) : (
            socials.socials.map((item) => {
              const meta = getSocialNetworkMeta(item.network)
              return (
                <GhostSettingValue
                  key={item.network}
                  label={meta.label}
                  value={item.link}
                  hint={item.name !== meta.defaultName ? item.name : undefined}
                />
              )
            })
          )}
        </div>
      )}
    </GhostSettingGroup>
  )
}
