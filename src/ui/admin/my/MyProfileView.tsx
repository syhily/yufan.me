import { KeyRoundIcon, SaveIcon, UserIcon } from 'lucide-react'
import { useState } from 'react'

import { useAdminMutation } from '@/client/api/use-admin-mutation'
import { API_ACTIONS } from '@/shared/api-actions'
import { Button } from '@/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

const UPDATE_PROFILE = API_ACTIONS.account.updateProfile
const UPDATE_PASSWORD = API_ACTIONS.account.updatePassword

interface Props {
  csrfToken: string
  currentUser: { id: string; name: string; email: string; role?: string | null }
}

export function MyProfileView({ currentUser }: Props) {
  const [name, setName] = useState(currentUser.name)
  const [link, setLink] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  const updateProfile = useAdminMutation<{ name?: string; link?: string | null }, { ok: boolean }>(UPDATE_PROFILE, {
    successMessage: '个人信息已保存',
  })

  const updatePassword = useAdminMutation<{ oldPassword: string; newPassword: string }, { ok: boolean }>(
    UPDATE_PASSWORD,
    {
      onSuccess: () => {
        setPasswordMessage('密码已修改，请重新登录。')
        setOldPassword('')
        setNewPassword('')
        setTimeout(() => {
          window.location.href = '/wp-login.php'
        }, 1500)
      },
    },
  )

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="size-5" />
            个人信息
          </CardTitle>
          <CardDescription>修改姓名和个人主页链接。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>邮箱</Label>
            <Input value={currentUser.email} disabled />
            <p className="text-xs text-muted-foreground">如需修改邮箱，请联系管理员。</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-name">姓名</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-link">个人主页</Label>
            <Input id="profile-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
          </div>
          <Button
            onClick={() => updateProfile.submit({ name, link: link || null })}
            disabled={updateProfile.isPending || !name.trim()}
            size="sm"
            className="self-start"
          >
            <SaveIcon className="size-4" />
            保存
          </Button>
          {updateProfile.error && <p className="text-sm text-destructive">{updateProfile.error.message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-5" />
            修改密码
          </CardTitle>
          <CardDescription>修改后所有设备将被登出，请重新登录。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="old-password">旧密码</Label>
            <Input
              id="old-password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">新密码</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <Button
            onClick={() => {
              setPasswordMessage('')
              updatePassword.submit({ oldPassword, newPassword })
            }}
            disabled={updatePassword.loading || !oldPassword || newPassword.length < 6}
            size="sm"
            className="self-start"
          >
            修改密码
          </Button>
          {updatePassword.error && <p className="text-sm text-destructive">{updatePassword.error.message}</p>}
          {passwordMessage && <p className="text-sm text-green-600">{passwordMessage}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
