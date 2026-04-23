import { redirect } from 'react-router'

import { AdminCommentsPage } from '@/components/admin/AdminCommentsPage'
import { BaseLayout } from '@/layouts/BaseLayout'
import { routeMeta } from '@/services/seo/meta'
import '@/assets/styles/select.css'

if (typeof window !== 'undefined') {
  void import('@/assets/scripts/admin/manage')
}

export async function loader({ request }: { request: Request }) {
  const { getRequestSession, isAdmin, userSession } = await import('@/services/auth/session.server')
  const session = await getRequestSession(request)
  if (!isAdmin(session)) {
    const redirectTo = new URL(request.url).pathname
    throw redirect(`/wp-login.php?redirect_to=${encodeURIComponent(redirectTo)}`)
  }

  return {
    currentUser: userSession(session),
  }
}

export function meta() {
  return routeMeta({ title: '评论管理' })
}

export default function AdminRoute({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  return (
    <BaseLayout admin currentPath="/wp-admin" footer={false}>
      <AdminCommentsPage
        currentUserName={loaderData.currentUser?.name || ''}
        currentUserEmail={loaderData.currentUser?.email || ''}
      />
    </BaseLayout>
  )
}
