import { Form, useNavigation } from 'react-router'

import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { Input } from '@/ui/admin/shadcn/components/ui/input'
import { Label } from '@/ui/admin/shadcn/components/ui/label'

export interface AdminInstallFormProps {
  token: string
}

// Stage-1 install form (admin credentials only). Distinct from
// `AdminCredentialsForm` (which serves the lightweight login flow at
// `/wp-login.php`) because the install path's submission auto-logs the
// new admin in and redirects to stage 2 — the form copy and submit
// label reflect that. Stage 2 (`SettingsInstallForm`) collects
// everything else.
export function AdminInstallForm({ token }: AdminInstallFormProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting' && navigation.formMethod === 'POST'

  return (
    <Form method="post" id="adminInstallForm" className="tw:flex tw:flex-col tw:gap-4">
      <input type="hidden" name="token" value={token} />

      <div className="tw:flex tw:flex-col tw:gap-2">
        <Label htmlFor="install-name">昵称</Label>
        <Input id="install-name" name="name" type="text" autoComplete="nickname" required disabled={isSubmitting} />
      </div>
      <div className="tw:flex tw:flex-col tw:gap-2">
        <Label htmlFor="install-email">邮箱</Label>
        <Input id="install-email" name="email" type="email" autoComplete="username" required disabled={isSubmitting} />
      </div>
      <div className="tw:flex tw:flex-col tw:gap-2">
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
        <p className="tw:text-muted-foreground tw:text-xs">至少 10 个字符。</p>
      </div>

      <Button type="submit" name="submit" disabled={isSubmitting} className="tw:w-full">
        {isSubmitting ? '创建中...' : '下一步：站点初始化'}
      </Button>
    </Form>
  )
}
