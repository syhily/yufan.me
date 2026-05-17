import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useRef } from 'react'

import type { StepProps } from '@/ui/admin/auth/install-wizard/StepSiteIdentity'

import { useInstallWizard } from '@/ui/admin/auth/install-wizard/InstallWizardContext'
import { Button } from '@/ui/components/button'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

export function StepNavigationSocials(_props: StepProps) {
  const { data, updateData } = useInstallWizard()

  // Stable key generators — survive re-renders so inputs don't lose focus
  const keySeqRef = useRef(0)
  const sideNavKeyMap = useRef<string[]>([])
  const socialKeyMap = useRef<string[]>([])

  // Sync key maps with data lengths (handles add / remove / hydration from SessionStorage)
  while (sideNavKeyMap.current.length < data.navigation.sideNav.length) {
    sideNavKeyMap.current.push(`nav-${++keySeqRef.current}`)
  }
  if (sideNavKeyMap.current.length > data.navigation.sideNav.length) {
    sideNavKeyMap.current.length = data.navigation.sideNav.length
  }
  while (socialKeyMap.current.length < data.socials.length) {
    socialKeyMap.current.push(`social-${++keySeqRef.current}`)
  }
  if (socialKeyMap.current.length > data.socials.length) {
    socialKeyMap.current.length = data.socials.length
  }

  const addSideNav = () => {
    sideNavKeyMap.current.push(`nav-${++keySeqRef.current}`)
    updateData((prev) => ({
      ...prev,
      navigation: {
        ...prev.navigation,
        sideNav: [...prev.navigation.sideNav, { text: '', link: '' }],
      },
    }))
  }

  const updateSideNav = (index: number, patch: { text?: string; link?: string; target?: string }) => {
    updateData((prev) => ({
      ...prev,
      navigation: {
        ...prev.navigation,
        sideNav: prev.navigation.sideNav.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      },
    }))
  }

  const removeSideNav = (index: number) => {
    sideNavKeyMap.current.splice(index, 1)
    updateData((prev) => ({
      ...prev,
      navigation: {
        ...prev.navigation,
        sideNav: prev.navigation.sideNav.filter((_, i) => i !== index),
      },
    }))
  }

  const addSocial = () => {
    socialKeyMap.current.push(`social-${++keySeqRef.current}`)
    updateData((prev) => ({
      ...prev,
      socials: [...prev.socials, { name: '', network: 'github' as const, type: 'link' as const, link: '' }],
    }))
  }

  const updateSocial = (index: number, patch: Partial<(typeof data.socials)[number]>) => {
    updateData((prev) => ({
      ...prev,
      socials: prev.socials.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  const removeSocial = (index: number) => {
    socialKeyMap.current.splice(index, 1)
    updateData((prev) => ({
      ...prev,
      socials: prev.socials.filter((_, i) => i !== index),
    }))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Side Navigation */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>顶部导航</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSideNav}>
            <PlusIcon size={14} className="mr-1" />
            添加
          </Button>
        </div>
        {data.navigation.sideNav.length === 0 && <p className="text-sm text-muted-foreground">暂无导航项。</p>}
        {data.navigation.sideNav.map((item, i) => (
          <div key={sideNavKeyMap.current[i]} className="flex items-center gap-2">
            <Input
              value={item.text}
              onChange={(e) => updateSideNav(i, { text: e.target.value })}
              placeholder="名称"
              className="flex-1"
            />
            <Input
              value={item.link}
              onChange={(e) => updateSideNav(i, { link: e.target.value })}
              placeholder="链接"
              className="flex-[2]"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeSideNav(i)}>
              <Trash2Icon size={14} />
            </Button>
          </div>
        ))}
      </div>

      {/* Social Links */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>社交链接</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSocial}>
            <PlusIcon size={14} className="mr-1" />
            添加
          </Button>
        </div>
        {data.socials.length === 0 && <p className="text-sm text-muted-foreground">暂无社交链接。</p>}
        {data.socials.map((item, i) => (
          <div key={socialKeyMap.current[i]} className="flex items-center gap-2">
            <select
              value={item.network}
              onChange={(e) => updateSocial(i, { network: e.target.value as typeof item.network })}
              className="h-9 rounded-sm border border-line bg-transparent px-2 text-sm"
            >
              <option value="github">GitHub</option>
              <option value="x">X / Twitter</option>
              <option value="weibo">微博</option>
              <option value="bilibili">Bilibili</option>
              <option value="zhihu">知乎</option>
            </select>
            <Input
              value={item.name}
              onChange={(e) => updateSocial(i, { name: e.target.value })}
              placeholder="显示名称"
              className="flex-1"
            />
            <Input
              value={item.link}
              onChange={(e) => updateSocial(i, { link: e.target.value })}
              placeholder="URL"
              className="flex-[2]"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeSocial(i)}>
              <Trash2Icon size={14} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
