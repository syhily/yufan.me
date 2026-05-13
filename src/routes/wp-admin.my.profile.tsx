import { data, Form } from 'react-router'

import { userSession } from '@/server/auth/primitives'
import { findUserById } from '@/server/db/query/user'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { Button } from '@/ui/components/button'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'

import type { Route } from './+types/wp-admin.my.profile'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '个人信息' }, bundleFromMatches(matches))
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = getRouteRequestContext({ request, context })
  const dbUser = await findUserById(BigInt(user!.id))
  return data({
    name: dbUser?.name ?? '',
    email: dbUser?.email ?? '',
    link: dbUser?.link ?? '',
    role: dbUser?.role ?? null,
    badgeName: dbUser?.badgeName ?? '',
    badgeColor: dbUser?.badgeColor ?? '',
  })
}

export default function MyProfileRoute({ loaderData }: Route.ComponentProps) {
  const roleLabel = loaderData.role === 'admin' ? '管理员' : loaderData.role === 'author' ? '作者' : '访客'
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">个人信息</h1>
      <Form method="post" action="/api/actions/account.updateProfile" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>用户名</Label>
          <Input name="name" defaultValue={loaderData.name} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label>邮箱</Label>
          <Input name="email" defaultValue={loaderData.email} disabled />
          <p className="text-xs text-muted-foreground">如需修改邮箱请联系管理员。</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label>个人主页</Label>
          <Input name="link" defaultValue={loaderData.link} />
        </div>
        {loaderData.role !== 'visitor' && (
          <>
            <div className="flex flex-col gap-2">
              <Label>徽章名称</Label>
              <Input name="badgeName" defaultValue={loaderData.badgeName} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>徽章颜色</Label>
              <Input
                name="badgeColor"
                type="color"
                defaultValue={loaderData.badgeColor || '#008c95'}
                className="h-10 p-1"
              />
            </div>
          </>
        )}
        <div className="flex flex-col gap-2">
          <Label>角色</Label>
          <Input value={roleLabel} disabled />
        </div>
        <Button type="submit">保存</Button>
      </Form>

      <hr />

      <Form method="post" action="/api/actions/account.updatePassword" className="flex flex-col gap-4">
        <h2 className="font-medium">修改密码</h2>
        <div className="flex flex-col gap-2">
          <Label>原密码</Label>
          <Input name="oldPassword" type="password" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label>新密码</Label>
          <Input name="newPassword" type="password" required minLength={6} />
        </div>
        <Button type="submit" variant="outline">
          修改密码
        </Button>
      </Form>
    </div>
  )
}
