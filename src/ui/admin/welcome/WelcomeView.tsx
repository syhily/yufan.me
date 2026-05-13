import type { Role } from '@/shared/api-actions'

import { Badge } from '@/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card'

const GREETINGS: Record<string, string> = {
  deepnight: '夜深了，{name}，还没睡么？记得早点休息',
  morning: '早上好，{name}，新的一天开始啦',
  noon: '中午好，{name}，记得吃午饭',
  afternoon: '下午好，{name}',
  evening: '晚上好，{name}',
}

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  author: '作者',
  visitor: '访客',
}

interface Props {
  role: Role | null
  userName: string
  greeting: string
}

export function WelcomeView({ role, userName, greeting }: Props) {
  const text = (GREETINGS[greeting] ?? '你好，{name}').replace('{name}', userName)
  const roleLabel = role ? ROLE_LABELS[role] : null

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-lg font-medium">{text}</p>
              {roleLabel && (
                <Badge variant="secondary" className="mt-2">
                  {roleLabel}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {role === 'admin' && <AdminQuickActions />}
        {role === 'author' && <AuthorQuickActions />}
        {role === 'visitor' && <VisitorQuickActions />}
      </div>
    </div>
  )
}

function AdminQuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">快速操作</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <QuickLink href="/wp-admin/posts/new" label="写新文章" />
        <QuickLink href="/wp-admin/pages/new" label="新建页面" />
        <QuickLink href="/wp-admin/comments" label="审核评论" />
        <QuickLink href="/wp-admin/settings/general" label="站点设置" />
      </CardContent>
    </Card>
  )
}

function AuthorQuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">快速操作</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <QuickLink href="/wp-admin/posts" label="写新文章" />
        <QuickLink href="/wp-admin/images" label="上传图片" />
      </CardContent>
    </Card>
  )
}

function VisitorQuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">快速操作</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <QuickLink href="/wp-admin/my/comments" label="我的评论" />
        <QuickLink href="/wp-admin/my/profile" label="个人信息" />
      </CardContent>
    </Card>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center rounded-md border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {label}
    </a>
  )
}
