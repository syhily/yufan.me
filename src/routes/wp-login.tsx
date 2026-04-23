import { useEffect } from 'react'
import { redirect, useActionData } from 'react-router'

import config from '@/blog.config'
import { LoginForm } from '@/components/admin/LoginForm'
import { AdminLayoutBody } from '@/layouts/AdminLayout'
import { signInSchema } from '@/schemas/auth'
import { routeMeta } from '@/services/seo/meta'
import { getClientAddress } from '@/shared/request'

export async function loader({ request }: { request: Request }) {
  const { destroySession, getRequestSession, userSession } = await import('@/services/auth/session.server')
  const session = await getRequestSession(request)
  const url = new URL(request.url)
  const redirectTo = url.searchParams.get('redirect_to') || config.website
  const action = url.searchParams.get('action')

  if (action === 'logout') {
    throw redirect(redirectTo, {
      headers: { 'Set-Cookie': await destroySession(session) },
    })
  }

  if (userSession(session)) {
    throw redirect(redirectTo)
  }

  return { redirectTo }
}

export async function action({ request }: { request: Request }) {
  const { commitSession, getRequestSession, login } = await import('@/services/auth/session.server')
  const session = await getRequestSession(request)
  const url = new URL(request.url)
  const redirectTo = url.searchParams.get('redirect_to') || '/wp-admin'
  const formData = await request.formData()
  const parsed = signInSchema.omit({ token: true }).safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: '请填写正确的邮箱和密码。', redirectTo }
  }

  const authenticated = await login({
    ...parsed.data,
    session,
    request,
    clientAddress: getClientAddress(request),
  })

  if (!authenticated) {
    return { error: '邮箱或密码错误。', redirectTo }
  }

  throw redirect(redirectTo, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export function meta() {
  return routeMeta({ title: '用户登陆' })
}

export default function LoginRoute() {
  const actionData = useActionData() as { error?: string } | undefined
  useEffect(() => {
    void import('@/assets/scripts/admin/login')
  }, [])

  return (
    <AdminLayoutBody>
      <div className="container">
        <h1 className="mb-4">用户登陆</h1>
        {actionData?.error && <div className="alert alert-danger">{actionData.error}</div>}
        <LoginForm action="" />
      </div>
    </AdminLayoutBody>
  )
}
