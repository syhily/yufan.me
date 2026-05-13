import { useState } from 'react'
import { useFetcher } from 'react-router'

import type { ApiEnvelope } from '@/shared/api-envelope'

import { useFetcherResult } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { Button } from '@/ui/components/button'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

const UPDATE_PROFILE = API_ACTIONS.account.updateProfile
const UPDATE_PASSWORD = API_ACTIONS.account.updatePassword

export interface MyProfileInitial {
  name: string
  email: string
  link: string
  role: 'admin' | 'author' | 'visitor' | null
  badgeName: string
  badgeColor: string
}

export interface MyProfileFormProps {
  initial: MyProfileInitial
}

const ROLE_LABEL: Record<NonNullable<MyProfileInitial['role']>, string> = {
  admin: '管理员',
  author: '作者',
  visitor: '访客',
}

export function MyProfileForm({ initial }: MyProfileFormProps) {
  const profileFetcher = useFetcher<ApiEnvelope<{ user: unknown }>>()
  const passwordFetcher = useFetcher<ApiEnvelope<{ success: boolean }>>()

  const [name, setName] = useState(initial.name)
  const [link, setLink] = useState(initial.link)
  const [badgeName, setBadgeName] = useState(initial.badgeName)
  const [badgeColor, setBadgeColor] = useState(initial.badgeColor || '#008c95')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  useFetcherResult(profileFetcher, {
    action: UPDATE_PROFILE,
    onSuccess: () => setProfileMessage('已保存。'),
  })
  useFetcherResult(passwordFetcher, {
    action: UPDATE_PASSWORD,
    onSuccess: () => {
      setPasswordMessage('密码已更新；其他设备的会话已注销。')
      setOldPassword('')
      setNewPassword('')
    },
  })

  const profileError = profileFetcher.data?.error?.message
  const passwordError = passwordFetcher.data?.error?.message
  const canSetBadge = initial.role === 'admin' || initial.role === 'author'
  const roleLabel = initial.role ? ROLE_LABEL[initial.role] : '匿名'

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">个人信息</h1>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setProfileMessage(null)
          const payload: Record<string, string | null> = { name, link: link || '' }
          if (canSetBadge) {
            payload.badgeName = badgeName || null
            payload.badgeColor = badgeColor || null
          }
          void profileFetcher.submit(payload, {
            method: UPDATE_PROFILE.method,
            encType: 'application/json',
            action: UPDATE_PROFILE.path,
          })
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-name">用户名</Label>
          <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-email">邮箱</Label>
          <Input id="profile-email" defaultValue={initial.email} disabled />
          <p className="text-xs text-muted-foreground">如需修改邮箱请联系管理员。</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-link">个人主页</Label>
          <Input id="profile-link" value={link} onChange={(e) => setLink(e.target.value)} />
        </div>
        {canSetBadge && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-badge-name">徽章名称</Label>
              <Input id="profile-badge-name" value={badgeName} onChange={(e) => setBadgeName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-badge-color">徽章颜色</Label>
              <Input
                id="profile-badge-color"
                type="color"
                value={badgeColor}
                onChange={(e) => setBadgeColor(e.target.value)}
                className="h-10 p-1"
              />
            </div>
          </>
        )}
        <div className="flex flex-col gap-2">
          <Label>角色</Label>
          <Input value={roleLabel} disabled />
        </div>
        {profileError && <div className="text-sm text-destructive">{profileError}</div>}
        {profileMessage && <div className="text-sm text-green-600">{profileMessage}</div>}
        <Button type="submit" disabled={profileFetcher.state !== 'idle'}>
          {profileFetcher.state !== 'idle' ? '保存中…' : '保存'}
        </Button>
      </form>

      <hr />

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setPasswordMessage(null)
          void passwordFetcher.submit(
            { oldPassword, newPassword },
            {
              method: UPDATE_PASSWORD.method,
              encType: 'application/json',
              action: UPDATE_PASSWORD.path,
            },
          )
        }}
      >
        <h2 className="font-medium">修改密码</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-old-pw">原密码</Label>
          <Input
            id="profile-old-pw"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-new-pw">新密码</Label>
          <Input
            id="profile-new-pw"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        {passwordError && <div className="text-sm text-destructive">{passwordError}</div>}
        {passwordMessage && <div className="text-sm text-green-600">{passwordMessage}</div>}
        <Button type="submit" variant="outline" disabled={passwordFetcher.state !== 'idle'}>
          {passwordFetcher.state !== 'idle' ? '更新中…' : '修改密码'}
        </Button>
      </form>
    </div>
  )
}
