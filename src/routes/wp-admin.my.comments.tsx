import { data } from 'react-router'

import type { PortableTextBody as PortableTextBodyType } from '@/shared/pt/schema'

import { countMyComments, listMyComments } from '@/server/db/query/comment'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { MyCommentsList } from '@/ui/admin/my/MyCommentsList'

import type { Route } from './+types/wp-admin.my.comments'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '我的评论' }, bundleFromMatches(matches))
}

export interface MyCommentItem {
  id: string
  body: PortableTextBodyType
  createdAtIso: string
  deletedAtIso: string | null
  deleteRequestedAtIso: string | null
  isPending: boolean
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = getRouteRequestContext({ request, context })
  if (!user) {
    throw new Response('Unauthorized', { status: 401 })
  }
  const userId = BigInt(user.id)
  const url = new URL(request.url)
  const offset = Number(url.searchParams.get('offset') ?? '0')
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 100)
  const [comments, counts] = await Promise.all([listMyComments(userId, offset, limit), countMyComments(userId)])
  const items: MyCommentItem[] = comments.map((c) => ({
    id: String(c.id),
    body: (c.body ?? []) as PortableTextBodyType,
    createdAtIso: c.createAt ? new Date(c.createAt).toISOString() : '',
    deletedAtIso: c.deleteAt ? new Date(c.deleteAt).toISOString() : null,
    deleteRequestedAtIso: c.deleteRequestedAt ? new Date(c.deleteRequestedAt).toISOString() : null,
    isPending: c.isPending === true,
  }))
  return data({ items, counts, offset, limit })
}

export default function MyCommentsRoute({ loaderData }: Route.ComponentProps) {
  return <MyCommentsList items={loaderData.items} counts={loaderData.counts} />
}
