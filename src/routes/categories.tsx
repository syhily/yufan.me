import { CategoriesBody } from '@/components/page/categories/CategoriesBody'
import { BaseLayout } from '@/layouts/BaseLayout'
import { routeMeta } from '@/services/seo/meta'

export async function loader({ request }: { request: Request }) {
  const [{ getRequestSession, isAdmin }, { getCategories }] = await Promise.all([
    import('@/services/auth/session.server'),
    import('@/services/catalog/schema'),
  ])
  const session = await getRequestSession(request)
  const categories = (await getCategories()).slice().sort((a, b) => b.counts - a.counts)
  return {
    admin: isAdmin(session),
    currentPath: '/categories',
    categories,
    title: '分类',
  }
}

export function meta() {
  return routeMeta({ title: '分类' })
}

export default function CategoriesRoute({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  return (
    <BaseLayout admin={loaderData.admin} currentPath={loaderData.currentPath}>
      <CategoriesBody title={loaderData.title} categories={loaderData.categories} />
    </BaseLayout>
  )
}
