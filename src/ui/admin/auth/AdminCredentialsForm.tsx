import { Form, Link, useNavigation } from 'react-router'

import { Button } from '@/ui/components/button'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

export interface AdminCredentialsFormProps {
  action?: string
  csrf: string
  mode?: 'login' | 'lostpassword' | 'resetpassword' | 'accept-invite'
  resetToken?: string
}

const inputClasses =
  'h-[54px] rounded-lg border-0 bg-muted/50 px-4 text-[17px] placeholder:text-muted-foreground/50 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary'

export function AdminCredentialsForm({ action, csrf, mode = 'login', resetToken }: AdminCredentialsFormProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting' && navigation.formMethod === 'POST'

  if (mode === 'lostpassword') {
    return (
      <Form method="post" action={action} id="loginForm" className="flex flex-col gap-6">
        <input type="hidden" name="csrf" value={csrf} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="loginForm-email" className="text-[13px] font-semibold">
            邮箱
          </Label>
          <Input
            id="loginForm-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={isSubmitting}
            className={inputClasses}
          />
        </div>
        <Button
          type="submit"
          name="submit"
          disabled={isSubmitting}
          className="h-[52px] rounded-lg bg-brand-dark text-[17px] font-normal text-white hover:opacity-90"
        >
          {isSubmitting ? '发送中...' : '发送重置邮件'}
        </Button>
        <p className="text-center text-[13px] text-muted-foreground">
          <Link to="/admin/signin" className="transition-colors hover:text-foreground">
            返回登陆
          </Link>
        </p>
      </Form>
    )
  }

  if (mode === 'resetpassword' || mode === 'accept-invite') {
    return (
      <Form method="post" action={action} id="loginForm" className="flex flex-col gap-6">
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="reset_token" value={resetToken ?? ''} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="loginForm-password" className="text-[13px] font-semibold">
            新密码
          </Label>
          <Input
            id="loginForm-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            disabled={isSubmitting}
            className={inputClasses}
          />
        </div>
        <Button
          type="submit"
          name="submit"
          disabled={isSubmitting}
          className="h-[52px] rounded-lg bg-brand-dark text-[17px] font-normal text-white hover:opacity-90"
        >
          {isSubmitting ? '保存中...' : '设置密码'}
        </Button>
      </Form>
    )
  }

  return (
    <Form method="post" action={action} id="loginForm" className="flex flex-col gap-6">
      <input type="hidden" name="csrf" value={csrf} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="loginForm-email" className="text-[13px] font-semibold">
          邮箱
        </Label>
        <Input
          id="loginForm-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isSubmitting}
          className={inputClasses}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="loginForm-password" className="text-[13px] font-semibold">
          密码
        </Label>
        <div className="relative">
          <Input
            id="loginForm-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={10}
            disabled={isSubmitting}
            className={`${inputClasses} pr-[5.5rem]`}
          />
          <Link
            to="?action=lostpassword"
            className="absolute top-[1px] right-[1px] bottom-[1px] flex items-center border-l border-muted px-4 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            忘记？
          </Link>
        </div>
      </div>
      <Button
        type="submit"
        name="submit"
        disabled={isSubmitting}
        className="h-[52px] rounded-lg bg-brand-dark text-[17px] font-normal text-white hover:opacity-90"
      >
        {isSubmitting ? '登陆中...' : '登陆'}
      </Button>
    </Form>
  )
}
