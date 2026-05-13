import bcrypt from 'bcryptjs'
import { data, redirect } from 'react-router'

import { login, logout } from '@/server/auth/primitives'
import { signInSchema } from '@/server/auth/schema'
import { consumeToken } from '@/server/auth/verification-tokens'
import { countApprovedCommentsByUser } from '@/server/db/query/comment'
import { findUserByEmail, updateUserById } from '@/server/db/query/user'
import { sendPasswordReset } from '@/server/email/sender'
import { ensureInstalledOrRedirect } from '@/server/install/gate'
import { tryPasswordResetRateLimit } from '@/server/rate-limit'
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

export async function loader({ request, context }: Route.LoaderArgs) {
  await ensureInstalledOrRedirect()

  const { session, user, url } = getRouteRequestContext({ request, context })
  const redirectTo = safeRedirectPath(url.searchParams.get('redirect_to'), '/', url.origin)
  const action = url.searchParams.get('action')

  if (action === 'logout') {
    await logout(session)
    throw redirect(redirectTo, {
      headers: { 'Set-Cookie': await destroySession(session) },
    })
  }

  if (user) {
    throw redirect(redirectTo)
  }

  const { token, setCookie } = await issueCsrfToken()

  // For reset / invite, validate token early so the UI can show an error
  // before the user types a new password.
  let tokenError: string | null = null
  if ((action === 'resetpassword' || action === 'accept-invite') && url.searchParams.has('token')) {
    const rawToken = url.searchParams.get('token')!
    const purpose = action === 'resetpassword' ? 'password-reset' : 'author-invite'
    const result = await consumeToken(rawToken, purpose)
    if (result === null) {
      tokenError = '链接无效或已过期。'
    }
  }

  return data({ redirectTo, token, action: action ?? 'login', tokenError }, { headers: { 'Set-Cookie': setCookie } })
}

export async function action({ request, context }: Route.ActionArgs) {
  await ensureInstalledOrRedirect()

  const { session, clientAddress, url } = getRouteRequestContext({ request, context })
  const redirectTo = safeRedirectPath(url.searchParams.get('redirect_to'), '/wp-admin', url.origin)
  const action = url.searchParams.get('action')

  if (action === 'lostpassword') {
    const formData = await request.formData()
    const email = String(formData.get('email') ?? '')
    // Rate-limit before any lookup to prevent abuse.
    const limit = await tryPasswordResetRateLimit(clientAddress)
    if (limit.exceeded) {
      return data({ error: null, message: '如果该邮箱存在且符合要求，重置邮件已发送。' })
    }
    // Always appear to succeed to prevent email enumeration.
    if (email) {
      const u = await findUserByEmail(email)
      if (u && u.role) {
        // Existing user with a role — send reset email.
        const { token } = await import('@/server/auth/verification-tokens').then((m) => m.issueResetToken(Number(u.id)))
        const origin = new URL(request.url).origin
        const link = `${origin}/wp-login.php?action=resetpassword&token=${encodeURIComponent(token)}`
        await sendPasswordReset(u, link)
      } else if (u && !u.role && u.password === '') {
        // Anonymous commenter with no role — check if they have approved comments.
        const approved = await countApprovedCommentsByUser(u.id)
        if (approved >= 1) {
          // Upgrade to visitor and send setup email.
          await updateUserById(u.id, { role: 'visitor' } as never)
          const { token } = await import('@/server/auth/verification-tokens').then((m) =>
            m.issueResetToken(Number(u.id)),
          )
          const origin = new URL(request.url).origin
          const link = `${origin}/wp-login.php?action=resetpassword&token=${encodeURIComponent(token)}`
          await sendPasswordReset(u, link)
        }
      }
    }
    return data({ error: null, message: '如果该邮箱存在且符合要求，重置邮件已发送。' })
  }

  if (action === 'resetpassword' || action === 'accept-invite') {
    const formData = await request.formData()
    const rawToken = String(formData.get('token') ?? '')
    const newPassword = String(formData.get('password') ?? '')
    const purpose = action === 'resetpassword' ? 'password-reset' : 'author-invite'

    if (!newPassword || newPassword.length < 6) {
      return data({ error: '密码长度至少 6 位。' })
    }

    const result = await consumeToken(rawToken, purpose)
    if (result === null) {
      return data({ error: '链接无效或已过期。' })
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    await updateUserById(BigInt(result.userId), { password: hashed })

    // Auto-login after password set.
    const ok = await login({ email: '', password: '', session, request, clientAddress })
    // login above uses email+password; we need a custom login since we only have userId.
    // Simpler: fetch user and set session manually.
    const { findUserById } = await import('@/server/db/query/user')
    const u = await findUserById(BigInt(result.userId))
    if (u && u.role) {
      session.set('user', {
        id: String(u.id),
        name: u.name,
        email: u.email,
        website: u.link,
        role: u.role,
        admin: u.role === 'admin',
      })
    }

    return redirect(redirectTo, { headers: { 'Set-Cookie': await commitSession(session) } })
  }

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

export default function LoginRoute({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">用户登陆</CardTitle>
        <CardDescription>
          {loaderData.action === 'lostpassword'
            ? '输入邮箱以接收密码重置链接。'
            : loaderData.action === 'resetpassword'
              ? '设置新密码。'
              : loaderData.action === 'accept-invite'
                ? '设置登录密码以接受邀请。'
                : '使用管理员邮箱与密码登陆后台。'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {actionData?.error && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {actionData.error}
          </div>
        )}
        {(actionData as unknown as { message?: string })?.message && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-600"
          >
            {(actionData as unknown as { message?: string }).message}
          </div>
        )}
        {loaderData.tokenError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {loaderData.tokenError}
          </div>
        )}
        <AdminCredentialsForm
          token={loaderData.token}
          mode={loaderData.action as 'login' | 'lostpassword' | 'resetpassword' | 'accept-invite'}
          resetToken={
            typeof window !== 'undefined'
              ? (new URL(window.location.href).searchParams.get('token') ?? undefined)
              : undefined
          }
        />
      </CardContent>
    </Card>
  )
}
