import { data } from 'react-router'

import { userSession } from '@/server/auth/primitives'
import { countMyComments, listMyComments } from '@/server/db/query/comment'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'

import type { Route } from './+types/wp-admin.my.comments'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '我的评论' }, bundleFromMatches(matches))
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = getRouteRequestContext({ request, context })
  const userId = BigInt(user!.id)
  const url = new URL(request.url)
  const offset = Number(url.searchParams.get('offset') ?? '0')
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 100)
  const [comments, counts] = await Promise.all([listMyComments(userId, offset, limit), countMyComments(userId)])
  return data({ comments, counts, offset, limit })
}

export default function MyCommentsRoute({ loaderData }: Route.ComponentProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">我的评论</h1>
      <div className="text-sm text-muted-foreground">
        总计 {loaderData.counts.total} 条 · 待审 {loaderData.counts.pending} · 申请删除{' '}
        {loaderData.counts.deleteRequested}
      </div>
      <div className="flex flex-col gap-2">
        {loaderData.comments.map((c) => (
          <div key={String(c.id)} className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">{c.createAt?.toISOString()}</div>
            <div className="mt-1 text-sm" dangerouslySetInnerHTML={{ __html: c.content ?? '' }} />
            {c.isPending && <span className="text-xs text-amber-600">待审</span>}
            {c.deleteRequestedAt && <span className="text-xs text-red-600">已申请删除</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
