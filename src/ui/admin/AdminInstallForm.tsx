import { Form, useNavigation } from 'react-router'

import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'

export interface AdminInstallFormProps {
  token: string
}

// `AdminCredentialsForm` (which serves the lightweight login flow at
// `/wp-login.php`) because the install path's submission auto-logs the
// everything else.
export function AdminInstallForm({ token }: AdminInstallFormProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting' && navigation.formMethod === 'POST'

  return (
    <Form method="post" id="adminInstallForm" className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="install-name">昵称</Label>
        <Input id="install-name" name="name" type="text" autoComplete="nickname" required disabled={isSubmitting} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="install-email">邮箱</Label>
        <Input id="install-email" name="email" type="email" autoComplete="username" required disabled={isSubmitting} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="install-password">密码</Label>
        <Input
          id="install-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">至少 10 个字符。</p>
      </div>

      <Button type="submit" name="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? '创建中...' : '下一步：站点初始化'}
      </Button>
    </Form>
  )
}
