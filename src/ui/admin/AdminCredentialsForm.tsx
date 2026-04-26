import { Form, useNavigation } from 'react-router'

// LoginForm and InstallForm previously duplicated 90% of the same JSX (CSRF
// token hidden field, email + password inputs, submit button styling). The
// only meaningful differences are: (1) install adds a `name` field above
// email; (2) the submit-button label and the form `id`. Centralising the
// markup here keeps the WordPress-style HTML stable across both flows and
// gives us one place to evolve the styling.
//
// React Router 7 owns the submission lifecycle: `<Form>` posts straight to
// the route `action`, `useNavigation()` exposes the in-flight state so the
// submit button can disable itself, and there is no client-only JS bridge
// (no `assets/scripts/admin/login.ts` glue, no `/api/actions/auth/*` JSON
// duplicate). The form continues to degrade gracefully without JS — RR
// falls back to a plain HTML POST through the same action.

export type AdminCredentialsMode = 'login' | 'install'

export interface AdminCredentialsFormProps {
  mode: AdminCredentialsMode
  /**
   * Optional `<Form action>` override. Defaults to the current route's URL
   * (so the route's own `action` handles the POST). Pass an empty string to
   * preserve the previous behaviour explicitly.
   */
  action?: string
  token: string
}

const MODE_CONFIG = {
  login: { id: 'loginForm', submitLabel: '登陆', pendingLabel: '登陆中...' },
  install: { id: 'installForm', submitLabel: '注册管理员', pendingLabel: '注册中...' },
} as const

export function AdminCredentialsForm({ mode, action, token }: AdminCredentialsFormProps) {
  const { id, submitLabel, pendingLabel } = MODE_CONFIG[mode]
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting' && navigation.formMethod === 'POST'

  return (
    <Form method="post" action={action} id={id}>
      <input type="hidden" name="token" value={token} />
      <div className="flex-fill">
        <div className="row g-3 mb-5 px-5">
          {mode === 'install' && (
            <input className="form-control mb-2" placeholder="昵称" name="name" type="text" required />
          )}
          <input className="form-control mb-2" placeholder="邮箱" name="email" type="email" required />
          <input
            className="form-control mb-2"
            placeholder="密码"
            name="password"
            type="password"
            required
            minLength={10}
          />
        </div>
        <div className="form-submit text-center">
          <input
            name="submit"
            type="submit"
            id="submit"
            className="btn btn-primary col-4"
            value={isSubmitting ? pendingLabel : submitLabel}
            disabled={isSubmitting}
          />
        </div>
      </div>
    </Form>
  )
}
