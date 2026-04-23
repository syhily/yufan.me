import { useEffect } from 'react'
import { redirect, useActionData } from 'react-router'

import { InstallForm } from '@/components/admin/InstallForm'
import { AdminLayoutBody } from '@/layouts/AdminLayout'
import { signUpAdminSchema } from '@/schemas/auth'
import { routeMeta } from '@/services/seo/meta'

export async function loader() {
  const { hasAdmin } = await import('@/db/query/user.server')
  if (await hasAdmin()) {
    throw redirect('/wp-login.php')
  }

  return null
}

export async function action({ request }: { request: Request }) {
  const [{ insertAdmin, hasAdmin }, { commitSession, getRequestSession }] = await Promise.all([
    import('@/db/query/user.server'),
    import('@/services/auth/session.server'),
  ])
  if (await hasAdmin()) {
    throw redirect('/wp-login.php')
  }

  const formData = await request.formData()
  const parsed = signUpAdminSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: '请填写完整的管理员信息。' }
  }

  const users = await insertAdmin(parsed.data.name, parsed.data.email, parsed.data.password)
  const admin = users[0]
  if (!admin) {
    return { error: '管理员创建失败。' }
  }

  const session = await getRequestSession(request)
  session.set('user', {
    id: `${admin.id}`,
    name: admin.name,
    email: admin.email,
    website: admin.link,
    admin: true,
  })

  throw redirect('/wp-admin', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export function meta() {
  return routeMeta({ title: '注册管理员账号' })
}

export default function AdminInstallRoute() {
  const actionData = useActionData() as { error?: string } | undefined
  useEffect(() => {
    void import('@/assets/scripts/admin/install')
  }, [])

  return (
    <AdminLayoutBody>
      <div className="container">
        <h1 className="mb-4">注册管理员账号</h1>
        {actionData?.error && <div className="alert alert-danger">{actionData.error}</div>}
        <InstallForm action="" />
      </div>
    </AdminLayoutBody>
  )
}
