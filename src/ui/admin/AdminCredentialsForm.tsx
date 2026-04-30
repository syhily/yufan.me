import { Form, useNavigation } from 'react-router'

import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { Input } from '@/ui/admin/shadcn/components/ui/input'
import { Label } from '@/ui/admin/shadcn/components/ui/label'

// Login-form markup (CSRF token + email + password). Lives in its own
// component so the WordPress-style HTML stays stable across any future
// callers and we have one place to evolve the styling.
//
// React Router 7 owns the submission lifecycle: `<Form>` posts straight
// to the route `action`, `useNavigation()` exposes the in-flight state
// so the submit button can disable itself, and there is no client-only
// JS bridge. The form continues to degrade gracefully without JS — RR
// falls back to a plain HTML POST through the same action.
//
// The install flow used to share this component through a `mode`
// discriminator. With the install split into stage 1
// (`AdminInstallForm`) and stage 2 (`SettingsInstallForm`) the shapes
// have diverged enough that each form is clearer as its own file.

export interface AdminCredentialsFormProps {
  /**
   * Optional `<Form action>` override. Defaults to the current route's
   * URL (so the route's own `action` handles the POST). Pass an empty
   * string to preserve the previous behaviour explicitly.
   */
  action?: string
  token: string
}

export function AdminCredentialsForm({ action, token }: AdminCredentialsFormProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting' && navigation.formMethod === 'POST'

  return (
    <Form method="post" action={action} id="loginForm" className="tw:flex tw:flex-col tw:gap-5">
      <input type="hidden" name="token" value={token} />
      <div className="tw:flex tw:flex-col tw:gap-2">
        <Label htmlFor="loginForm-email">邮箱</Label>
        <Input id="loginForm-email" name="email" type="email" autoComplete="email" required disabled={isSubmitting} />
      </div>
      <div className="tw:flex tw:flex-col tw:gap-2">
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
      <Button type="submit" name="submit" disabled={isSubmitting} className="tw:w-full">
        {isSubmitting ? '登陆中...' : '登陆'}
      </Button>
    </Form>
  )
}
