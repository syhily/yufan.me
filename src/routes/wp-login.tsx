import { data, redirect } from 'react-router'

import { signInSchema } from '@/server/auth/schema'
import {
  consumeResetAndSetPassword,
  consumeSetupAndSetPassword,
  issueResetToken,
} from '@/server/auth/verification-tokens'
import { countApprovedCommentsByUser } from '@/server/db/query/comment'
import { findUserByEmail, updateUserRole } from '@/server/db/query/user'
import { sendPasswordReset } from '@/server/email/sender'
import { ensureInstalledOrRedirect } from '@/server/install/gate'
import { tryKeyedRateLimit } from '@/server/rate-limit'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import {
  issueCsrfToken,
  signInWithSession,
  processAuthFormSubmission,
  getRouteRequestContext,
  destroySession,
  commitSession,
} from '@/server/session'
import { safeRedirectPath } from '@/shared/safe-url'
import { AdminCredentialsForm } from '@/ui/admin/auth/AdminCredentialsForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card'

import type { Route } from './+types/wp-login'

const LOST_PASSWORD_BUCKET = { maxAttempts: 1, windowSeconds: 300 }
const RESET_PASSWORD_BUCKET = { maxAttempts: 5, windowSeconds: 60 }

export async function loader({ request, context }: Route.LoaderArgs) {
  await ensureInstalledOrRedirect()

  const { session, user, url } = getRouteRequestContext({ request, context })
  const redirectTo = safeRedirectPath(url.searchParams.get('redirect_to'), '/', url.origin)
  const action = url.searchParams.get('action')
  const token = url.searchParams.get('token')

  if (action === 'logout') {
    throw redirect(redirectTo, {
      headers: { 'Set-Cookie': await destroySession(session) },
    })
  }

  // Token verification for resetpassword / accept-invite (GET: render form).
  if (action === 'resetpassword' && token) {
    const csrf = await issueCsrfToken()
    return data(
      { redirectTo, token, action, csrfToken: csrf.token, valid: true },
      { headers: { 'Set-Cookie': csrf.setCookie } },
    )
  }

  if (action === 'accept-invite' && token) {
    const csrf = await issueCsrfToken()
    return data(
      { redirectTo, token, action, csrfToken: csrf.token, valid: true },
      { headers: { 'Set-Cookie': csrf.setCookie } },
    )
  }

  if (user) {
    throw redirect(redirectTo)
  }

  const { token: csrfToken, setCookie } = await issueCsrfToken()
  if (action === 'lostpassword') {
    return data({ redirectTo, token: csrfToken, action: 'lostpassword' }, { headers: { 'Set-Cookie': setCookie } })
  }

  return data({ redirectTo, token: csrfToken }, { headers: { 'Set-Cookie': setCookie } })
}

export async function action({ request, context }: Route.ActionArgs) {
  await ensureInstalledOrRedirect()

  const { session, clientAddress, url } = getRouteRequestContext({ request, context })
  const redirectTo = safeRedirectPath(url.searchParams.get('redirect_to'), '/wp-admin', url.origin)
  const action = url.searchParams.get('action')

  // Lost password — send reset email.
  if (action === 'lostpassword') {
    const formData = await request.formData()
    const email = String(formData.get('email') ?? '').trim()
    const token = String(formData.get('token') ?? '')

    // Rate limit by IP and by email.
    const ipKey = `rate-limit:lostpassword:ip:${clientAddress}`
    const emailKey = `rate-limit:lostpassword:email:${email.toLowerCase()}`
    const [ipLimit, emailLimit] = await Promise.all([
      tryKeyedRateLimit(ipKey, LOST_PASSWORD_BUCKET),
      tryKeyedRateLimit(emailKey, LOST_PASSWORD_BUCKET),
    ])

    // Always return 200 with the same message regardless of outcome.
    const successMessage = '如果该邮箱已注册，您将收到一封密码重置邮件。'

    if (ipLimit.exceeded || emailLimit.exceeded) {
      return { message: successMessage }
    }
    if (!email) {
      return { message: successMessage }
    }

    const user = await findUserByEmail(email)
    if (user === null) {
      return { message: successMessage }
    }

    // Branch: user has role → normal password reset.
    if (user.role !== null) {
      const { token: resetToken } = await issueResetToken(user.id)
      const resetLink = `${url.origin}/wp-login.php?action=resetpassword&token=${resetToken}`
      await sendPasswordReset(user.email, user.name, resetLink, false).catch(() => undefined)
      return { message: successMessage }
    }

    // Branch: user role IS NULL and password is empty → potential visitor upgrade.
    if (user.password === '' || user.password === null) {
      const approvedCount = await countApprovedCommentsByUser(user.id)
      if (approvedCount >= 1) {
        // Upgrade to visitor and send set-password email.
        await updateUserRole(user.id, 'visitor')
        const { token: resetToken } = await issueResetToken(user.id)
        const resetLink = `${url.origin}/wp-login.php?action=resetpassword&token=${resetToken}`
        await sendPasswordReset(user.email, user.name, resetLink, true).catch(() => undefined)
        return { message: successMessage }
      }
    }

    // No approved comments → pretend success.
    return { message: successMessage }
  }

  // Reset password (or set initial password) — consume token and set password.
  if (action === 'resetpassword' || action === 'accept-invite') {
    const formData = await request.formData()
    const token = String(formData.get('token') ?? '')
    const password = String(formData.get('password') ?? '')
    const csrfField = String(formData.get('_csrf') ?? '')

    // Rate limit per token: max 5 attempts per minute.
    const tokenRateKey = `rate-limit:reset:token:${token.slice(0, 32)}`
    const trl = await tryKeyedRateLimit(tokenRateKey, RESET_PASSWORD_BUCKET)
    if (trl.exceeded) {
      return data(
        { error: '请求过于频繁，请稍后再试。', redirectTo },
        { headers: { 'Set-Cookie': await commitSession(session) } },
      )
    }

    if (password.length < 6 || password.length > 128) {
      return data(
        { error: '密码长度需在 6 到 128 个字符之间。', redirectTo },
        { headers: { 'Set-Cookie': await commitSession(session) } },
      )
    }

    if (action === 'accept-invite') {
      const result = await consumeSetupAndSetPassword(token, password)
      if (!result.ok) {
        const msg = result.reason === 'already_set' ? '该账户已设置过密码，请直接登录。' : '链接无效或已过期。'
        return data({ error: msg, redirectTo }, { headers: { 'Set-Cookie': await commitSession(session) } })
      }
    } else {
      const result = await consumeResetAndSetPassword(token, password)
      if (!result.ok) {
        return data(
          { error: '链接无效或已过期。', redirectTo },
          { headers: { 'Set-Cookie': await commitSession(session) } },
        )
      }
    }

    // Redirect to login page after successful password set.
    return data(
      { message: '密码设置成功，请使用新密码登录。', redirectTo: '/wp-login.php' },
      { headers: { 'Set-Cookie': await commitSession(session) } },
    )
  }

  // Default: login.
  return processAuthFormSubmission({
    request,
    schema: signInSchema,
    fields: ['email', 'password', 'token'] as const,
    defaultErrorMessage: '请填写正确的邮箱和密码。',
    redirectTo,
    run: (input) => signInWithSession({ ...input, session, request, clientAddress, redirectTo }),
  })
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '用户登陆' }, bundleFromMatches(matches))
}

// Action data: each branch may return error, message, or both.
type LoginActionData = { error?: string; message?: string; redirectTo?: string }

export default function LoginRoute({ actionData, loaderData }: Route.ComponentProps) {
  const ad = actionData as LoginActionData | undefined
  const ld = loaderData as Record<string, unknown> | undefined
  const action = ld?.action as string | undefined

  if (action === 'resetpassword' && ld?.valid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">设置新密码</CardTitle>
          <CardDescription>请输入您的新密码。</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm
            token={String(ld?.token ?? '')}
            csrfToken={String(ld?.csrfToken ?? '')}
            action="resetpassword"
            error={ad?.error}
            message={ad?.message}
          />
        </CardContent>
      </Card>
    )
  }

  if (action === 'accept-invite' && ld?.valid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">接受作者邀请</CardTitle>
          <CardDescription>设置您的密码以开始写作。</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm
            token={String(ld?.token ?? '')}
            csrfToken={String(ld?.csrfToken ?? '')}
            action="accept-invite"
            error={ad?.error}
            message={ad?.message}
          />
        </CardContent>
      </Card>
    )
  }

  if (action === 'lostpassword') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">找回密码</CardTitle>
          <CardDescription>输入您的注册邮箱，我们将发送密码重置链接。</CardDescription>
        </CardHeader>
        <CardContent>
          <LostPasswordForm token={String(ld?.token ?? '')} error={ad?.error} message={ad?.message} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">用户登陆</CardTitle>
        <CardDescription>使用管理员邮箱与密码登陆后台。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {ad?.error && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {ad.error}
          </div>
        )}
        <AdminCredentialsForm token={String(ld?.token ?? '')} />
        <div className="text-center">
          <a href="/wp-login.php?action=lostpassword" className="text-sm text-muted-foreground hover:underline">
            忘记密码？
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

function LostPasswordForm({ token, error, message }: { token: string; error?: string; message?: string }) {
  return (
    <form method="post" className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {error && (
        <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">
          {message}
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">邮箱</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        发送重置链接
      </button>
    </form>
  )
}

function ResetPasswordForm({
  token,
  csrfToken,
  action,
  error,
  message,
}: {
  token: string
  csrfToken: string
  action: string
  error?: string
  message?: string
}) {
  return (
    <form method="post" className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="_csrf" value={csrfToken} />
      {error && (
        <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">
          {message}
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">新密码</span>
        <input
          type="password"
          name="password"
          required
          minLength={6}
          maxLength={128}
          autoComplete="new-password"
          className="rounded-md border px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {action === 'accept-invite' ? '设置密码并开始写作' : '设置新密码'}
      </button>
    </form>
  )
}
