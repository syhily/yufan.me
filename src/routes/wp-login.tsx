import bcrypt from 'bcryptjs'
import { data, redirect } from 'react-router'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { clearCsrfCookie, reuseOrIssueCsrfToken, validateRequestCsrf } from '@/server/domains/auth/csrf'
import { processAuthFormSubmission, signInWithSession } from '@/server/domains/auth/flows'
import { establishLoginSession, logout } from '@/server/domains/auth/primitives'
import { signInSchema } from '@/server/domains/auth/schema'
import { destroySession } from '@/server/domains/auth/session-storage'
import { consumeToken, issueResetToken, peekToken } from '@/server/domains/auth/verification-tokens'
import { ensureInstalledOrRedirect } from '@/server/domains/settings/install-gate'
import { countApprovedCommentsByUser } from '@/server/infra/db/operations/comment'
import { findUserByEmail, findUserById, updateUserById } from '@/server/infra/db/operations/user'
import { sendPasswordReset } from '@/server/infra/email/sender'
import { tryPasswordResetByEmailRateLimit, tryPasswordResetRateLimit } from '@/server/infra/rate-limit'
import { bundleFromMatches, routeMeta } from '@/server/render/seo/meta'
import { safeRedirectPath } from '@/shared/utils/safe-url'
import { AdminCredentialsForm } from '@/ui/admin/auth/AdminCredentialsForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card'

import type { Route } from './+types/wp-login'

function formFieldString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

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

  const { token, setCookie } = await reuseOrIssueCsrfToken(request)

  // For reset / invite, surface a token error on the loader so the UI
  // can short-circuit before the user types a new password. `peekToken`
  // is read-only on purpose — the action below consumes the token only
  // after the form is submitted.
  let tokenError: string | null = null
  let resetToken: string | null = null
  if ((action === 'resetpassword' || action === 'accept-invite') && url.searchParams.has('token')) {
    const rawToken = url.searchParams.get('token')!
    const purpose = action === 'resetpassword' ? 'password-reset' : 'author-invite'
    const result = await peekToken(rawToken, purpose)
    if (result === null) {
      tokenError = '链接无效或已过期。'
    } else {
      resetToken = rawToken
    }
  }

  return data(
    { redirectTo, csrf: token, action: action ?? 'login', tokenError, resetToken },
    setCookie === '' ? undefined : { headers: { 'Set-Cookie': setCookie } },
  )
}

export async function action({ request, context }: Route.ActionArgs) {
  await ensureInstalledOrRedirect()

  const { session, clientAddress, url } = getRouteRequestContext({ request, context })
  const redirectTo = safeRedirectPath(url.searchParams.get('redirect_to'), '/wp-admin', url.origin)
  const action = url.searchParams.get('action')

  if (action === 'lostpassword') {
    const formData = await request.formData()
    const email = formFieldString(formData, 'email')
    // Rate-limit before any lookup to prevent abuse. Two additive
    // buckets: per-IP catches one attacker fanning out across many
    // mailboxes; per-email catches one attacker rotating IPs against
    // a single mailbox. Either tripping silently short-circuits with
    // the generic success message so neither path leaks which limit
    // (or even which email) was throttled.
    const ipLimit = await tryPasswordResetRateLimit(clientAddress)
    const emailLimit = email ? await tryPasswordResetByEmailRateLimit(email) : null
    if (ipLimit.exceeded || emailLimit?.exceeded) {
      return data({ error: null, message: '如果该邮箱存在且符合要求，重置邮件已发送。' })
    }
    // Always appear to succeed to prevent email enumeration.
    if (email) {
      const u = await findUserByEmail(email)
      if (u && u.role) {
        // Existing user with a role — send reset email.
        const { token } = await issueResetToken(u.id)
        const origin = new URL(request.url).origin
        const link = `${origin}/wp-login.php?action=resetpassword&token=${encodeURIComponent(token)}`
        await sendPasswordReset(u, link)
      } else if (u && !u.role && u.password === '') {
        // Anonymous commenter with at least one approved comment can
        // claim the account by setting a password.
        const approved = await countApprovedCommentsByUser(u.id)
        if (approved >= 1) {
          await updateUserById(u.id, { role: 'visitor' })
          const { token } = await issueResetToken(u.id)
          const origin = new URL(request.url).origin
          const link = `${origin}/wp-login.php?action=resetpassword&token=${encodeURIComponent(token)}`
          await sendPasswordReset(u, link)
        }
      }
    }
    return data({ error: null, message: '如果该邮箱存在且符合要求，重置邮件已发送。' })
  }

  if (action === 'resetpassword' || action === 'accept-invite') {
    // Credential-rotating flow. Two non-negotiable invariants:
    //   1. CSRF must be validated. The reset link by itself is a bearer
    //      token leaked over email; without CSRF, a malicious page can
    //      submit it from elsewhere.
    //   2. ALL other sessions of the target user must be revoked before
    //      we issue a new one. This is the recovery path users walk
    //      after suspecting credential compromise; leaving an
    //      attacker-held cookie alive defeats the point.
    const formData = await request.formData()
    const csrf = formFieldString(formData, 'csrf')
    const [csrfOk] = await validateRequestCsrf(request, csrf)
    if (!csrfOk) {
      return data(
        { error: '页面安全令牌已失效，请刷新后重试。' },
        { headers: { 'Set-Cookie': await clearCsrfCookie() } },
      )
    }

    const rawToken = formFieldString(formData, 'reset_token')
    const newPassword = formFieldString(formData, 'password')
    const purpose = action === 'resetpassword' ? 'password-reset' : 'author-invite'

    if (!newPassword || newPassword.length < 6) {
      return data({ error: '密码长度至少 6 位。' })
    }

    const result = await consumeToken(rawToken, purpose)
    if (result === null) {
      return data({ error: '链接无效或已过期。' })
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    await updateUserById(result.userId, { password: hashed })

    const dbUser = await findUserById(result.userId)
    if (!dbUser || !dbUser.role) {
      return data({ error: '账户状态异常，无法登录。' })
    }
    // `{ revokeOtherSessions: true }` enforces invariant 2 at the top
    // of this branch: every other session of this user (incl. anything
    // an attacker might still hold) is destroyed before the new one
    // is issued. `establishLoginSession` mints the sid + cookie itself
    // (so we can index the real cookie sid against Redis); use its
    // returned `setCookie` rather than re-committing the in-memory
    // session — calling `commitSession` after would mint a SECOND sid
    // and orphan the one we just wrote.
    const established = await establishLoginSession(session, dbUser, request, clientAddress, {
      revokeOtherSessions: true,
    })
    return redirect(redirectTo, { headers: { 'Set-Cookie': established.setCookie } })
  }

  return processAuthFormSubmission({
    request,
    schema: signInSchema,
    fields: ['email', 'password', 'csrf'] as const,
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
          csrf={loaderData.csrf}
          mode={loaderData.action as 'login' | 'lostpassword' | 'resetpassword' | 'accept-invite'}
          resetToken={loaderData.resetToken ?? undefined}
        />
      </CardContent>
    </Card>
  )
}
