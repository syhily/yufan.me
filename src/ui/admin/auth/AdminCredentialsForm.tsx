import { Form, useNavigation } from 'react-router'

import { Button } from '@/ui/components/button'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

export interface AdminCredentialsFormProps {
  action?: string
  /** Anti-CSRF token issued by the loader. Submitted as `name="csrf"`. */
  csrf: string
  mode?: 'login' | 'lostpassword' | 'resetpassword' | 'accept-invite'
  /**
   * One-time token from the email link, passed to the loader through
   * the URL. The form re-submits it as a separate `name="reset_token"`
   * field — keeping CSRF and reset tokens on distinct names avoids the
   * FormData collision the previous shape walked into.
   */
  resetToken?: string
}

export function AdminCredentialsForm({ action, csrf, mode = 'login', resetToken }: AdminCredentialsFormProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting' && navigation.formMethod === 'POST'

  if (mode === 'lostpassword') {
    return (
      <Form method="post" action={action} id="loginForm" className="flex flex-col gap-5">
        <input type="hidden" name="csrf" value={csrf} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="loginForm-email">邮箱</Label>
          <Input id="loginForm-email" name="email" type="email" autoComplete="email" required disabled={isSubmitting} />
        </div>
        <Button type="submit" name="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? '发送中...' : '发送重置邮件'}
        </Button>
      </Form>
    )
  }

  if (mode === 'resetpassword' || mode === 'accept-invite') {
    return (
      <Form method="post" action={action} id="loginForm" className="flex flex-col gap-5">
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="reset_token" value={resetToken ?? ''} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="loginForm-password">新密码</Label>
          <Input
            id="loginForm-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            disabled={isSubmitting}
          />
        </div>
        <Button type="submit" name="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? '保存中...' : '设置密码'}
        </Button>
      </Form>
    )
  }

  return (
    <Form method="post" action={action} id="loginForm" className="flex flex-col gap-5">
      <input type="hidden" name="csrf" value={csrf} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="loginForm-email">邮箱</Label>
        <Input id="loginForm-email" name="email" type="email" autoComplete="email" required disabled={isSubmitting} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="loginForm-password">密码</Label>
        <Input
          id="loginForm-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={10}
          disabled={isSubmitting}
        />
      </div>
      <Button type="submit" name="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? '登陆中...' : '登陆'}
      </Button>
    </Form>
  )
}
