import { data } from 'react-router'

import { userSession } from '@/server/auth/primitives'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'

import type { Route } from './+types/wp-admin.welcome'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '欢迎' }, bundleFromMatches(matches))
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = getRouteRequestContext({ request, context })
  const now = new Date()
  const hour = now.getHours()
  let greeting = '你好'
  if (hour >= 23 || hour < 5) greeting = '夜深了，还没睡么？记得早点休息'
  else if (hour < 11) greeting = '早上好，新的一天开始啦'
  else if (hour < 14) greeting = '中午好，记得吃午饭'
  else if (hour < 18) greeting = '下午好'
  else greeting = '晚上好'

  return data({
    name: user?.name ?? '',
    role: user?.role ?? null,
    greeting,
  })
}

export default function WelcomeRoute({ loaderData }: Route.ComponentProps) {
  const { name, role, greeting } = loaderData
  const roleLabel = role === 'admin' ? '管理员' : role === 'author' ? '作者' : role === 'visitor' ? '访客' : '用户'
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between rounded-lg border bg-card p-6">
        <div>
          <h1 className="text-2xl font-semibold">
            {greeting}，{name}
          </h1>
          <p className="mt-1 text-muted-foreground">当前身份：{roleLabel}</p>
        </div>
      </div>
      {role === 'admin' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-medium">站点速览</h2>
            <p className="mt-1 text-sm text-muted-foreground">管理员仪表盘 Widget 占位</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-medium">待审评论</h2>
            <p className="mt-1 text-sm text-muted-foreground">管理员仪表盘 Widget 占位</p>
          </div>
        </div>
      )}
      {role === 'author' && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-medium">我的创作</h2>
          <p className="mt-1 text-sm text-muted-foreground">作者仪表盘 Widget 占位</p>
        </div>
      )}
      {role === 'visitor' && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-medium">我的评论</h2>
          <p className="mt-1 text-sm text-muted-foreground">访客仪表盘 Widget 占位</p>
        </div>
      )}
    </div>
  )
}
