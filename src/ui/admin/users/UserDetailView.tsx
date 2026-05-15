import type { NavigateFunction } from 'react-router'

import {
  ArrowLeftIcon,
  CheckCheckIcon,
  LogOutIcon,
  MailIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
  Volume2Icon,
  VolumeOffIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import type { AdminCommentWire as AdminComment } from '@/shared/contracts/_dtos'
import type {
  AdminMutationSuccessOutput,
  AdminUserDto,
  BulkApproveOutput,
  BulkSoftDeleteOutput,
  GetUserOutput,
  MuteUserOutput,
} from '@/shared/users'

import { api } from '@/client/api/client'
import { useApiMutation, useApiQuery, useQueryClient } from '@/client/api/query'
import { unwrap } from '@/client/api/unwrap'
type Role = NonNullable<AdminUserDto['role']>
import { queryKeys } from '@/client/api/query-keys'
import { formatLocalDate } from '@/shared/formatter'
import { idStr } from '@/shared/tools'
import { AdminListPage } from '@/ui/admin/shared/AdminListPage'
import { type ConfirmState, ConfirmDialog } from '@/ui/admin/shared/ConfirmDialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/avatar'
import { Badge } from '@/ui/components/badge'
import { Button } from '@/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card'
import { Checkbox } from '@/ui/components/checkbox'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select'
import { Separator } from '@/ui/components/separator'
import { Skeleton } from '@/ui/components/skeleton'
import { useSiteIdentity } from '@/ui/lib/blog-config-context'
import { PortableTextBody } from '@/ui/pt/render'

// Initial colour offered when an admin first ticks the "自定义字体颜色"
// checkbox. Mirrors the public `--badge-text` light value so the picker
// lands on the most common choice rather than `#000000`.
const DEFAULT_BADGE_TEXT_COLOR = '#ffffff'

const DATE_FORMAT = 'yyyy-LL-dd HH:mm'

export interface UserDetailViewProps {
  userId: string
  navigate: NavigateFunction
}

export function UserDetailView({ userId, navigate }: UserDetailViewProps) {
  const config = useSiteIdentity()

  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [link, setLink] = useState('')
  const [badgeName, setBadgeName] = useState('')
  const [badgeColor, setBadgeColor] = useState('#008c95')
  // Same two-state model as `EditUserDialog`: a checkbox controls
  // whether the form sends `null` (clear → auto-derive) or a hex value.
  const [useTextOverride, setUseTextOverride] = useState(false)
  const [badgeTextColor, setBadgeTextColor] = useState(DEFAULT_BADGE_TEXT_COLOR)
  const [roleDraft, setRoleDraft] = useState<Role | ''>('')

  const queryClient = useQueryClient()

  const userQuery = useApiQuery<GetUserOutput>(['admin', 'user', userId], () =>
    unwrap(api.admin.users.get({ id: userId })),
  )

  const commentsQuery = useApiQuery(queryKeys.admin.comments(userId), () =>
    unwrap(api.commentAdmin.loadAll({ offset: 0, limit: 10, userId })),
  )

  const user = userQuery.data?.user ?? null
  const comments: AdminComment[] = commentsQuery.data?.comments ?? []

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
      setLink(user.link ?? '')
      setBadgeName(user.badgeName ?? '')
      setBadgeColor(user.badgeColor ?? '#008c95')
      setUseTextOverride(user.badgeTextColor !== null)
      setBadgeTextColor(user.badgeTextColor ?? DEFAULT_BADGE_TEXT_COLOR)
    }
  }, [user])

  const updateMutation = useApiMutation(
    (vars: Record<string, string | null> & { userId: string }) => {
      const { userId, ...body } = vars
      return unwrap(api.admin.users.update({ id: userId, ...body }))
    },
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'user'] })
      },
    },
  )

  const sendResetMutation = useApiMutation<{ email: string }, { success: boolean }>((vars) =>
    unwrap(api.admin.users.sendPasswordReset(vars)),
  )

  const revokeSessionsMutation = useApiMutation<{ userId: string }, { success: boolean }>((vars) =>
    unwrap(api.admin.users.revokeAllSessions(vars)),
  )

  const muteMutation = useApiMutation<{ userId: string; muted: boolean }, MuteUserOutput>(
    (vars) => unwrap(api.admin.users.mute({ id: vars.userId, muted: vars.muted })),
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'user'] })
      },
    },
  )

  const deleteMutation = useApiMutation<{ userId: string }, void>(
    (vars) => unwrap(api.admin.users.softDelete({ id: vars.userId })),
    {
      onSuccess: () => {
        void navigate('/wp-admin/users')
      },
    },
  )

  const restoreMutation = useApiMutation<{ userId: string }, AdminMutationSuccessOutput>(
    (vars) => unwrap(api.admin.users.restore({ id: vars.userId, ...vars })),
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'user'] })
      },
    },
  )

  const bulkApproveMutation = useApiMutation<{ userId: string }, BulkApproveOutput>(
    (vars) => unwrap(api.admin.users.bulkApproveComments(vars)),
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'user'] })
        void queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] })
      },
    },
  )

  const bulkDeleteMutation = useApiMutation<{ userId: string }, BulkSoftDeleteOutput>(
    (vars) => unwrap(api.admin.users.bulkDeleteComments(vars)),
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'user'] })
        void queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] })
      },
    },
  )

  const updateRoleMutation = useApiMutation<{ userId: string; role: Role }, { user: AdminUserDto | null }>(
    (vars) => unwrap(api.admin.users.updateRole({ id: vars.userId, role: vars.role })),
    {
      onSuccess: () => {
        setRoleDraft('')
        void queryClient.invalidateQueries({ queryKey: ['admin', 'user'] })
      },
    },
  )

  if (!user) {
    return <UserDetailSkeleton />
  }

  const initial = (user.name || user.email || '?').slice(0, 1).toUpperCase()
  const updateError = updateMutation.error?.message

  return (
    <>
      <AdminListPage>
        {/*
         * Detail view doesn't use Toolbar / Body / PageNavigation, but it
         * still benefits from the shared `flex-col gap-6` shell. The back
         * button sits inline with the title block, which is structurally
         * different from the list-page `Header` (no description, no right
         * action slot), so we render the header inline instead of through
         * `AdminListPage.Header`.
         */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void navigate('/wp-admin/users')}
              aria-label="返回用户列表"
            >
              <ArrowLeftIcon />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">用户详情</h1>
              <p className="text-sm text-muted-foreground">查看与编辑该用户信息，并管理其评论。</p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-1">
            <Card>
              <CardContent className="flex flex-col items-center gap-4 text-center">
                <Avatar className="size-20">
                  <AvatarImage src={`/images/avatar/${user.id}.png`} alt={user.name} />
                  <AvatarFallback className="bg-muted text-lg font-semibold">{initial}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-lg font-semibold">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {user.role === 'admin' && <Badge variant="secondary">管理员</Badge>}
                  {user.role === 'author' && <Badge variant="secondary">作者</Badge>}
                  {user.role === 'visitor' && <Badge variant="secondary">访客</Badge>}
                  {user.role === null && <Badge variant="outline">匿名</Badge>}
                  {user.deletedAt ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      已删除
                    </Badge>
                  ) : user.isMuted ? (
                    <Badge variant="destructive">已禁言</Badge>
                  ) : (
                    <Badge variant="secondary">正常</Badge>
                  )}
                  {user.badgeName && (
                    <Badge
                      className="border-transparent"
                      style={{
                        backgroundColor: user.badgeColor || 'var(--brand)',
                        // The DB value already accounts for the manual
                        // override (or is `null` when the admin opted
                        // for auto-derive). The card preview is a
                        // best-effort glance, so when no override is
                        // stored we just fall back to white — the
                        // public renderer applies the proper WCAG pick.
                        color: user.badgeTextColor || '#fff',
                      }}
                    >
                      {user.badgeName}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>统计信息</CardTitle>
                <CardDescription>评论次数与最近活动。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">评论总数</span>
                  <span className="font-medium">{user.commentCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">待审核</span>
                  <span className={user.pendingCount > 0 ? 'font-medium text-destructive' : 'font-medium'}>
                    {user.pendingCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">最近评论</span>
                  <span>
                    {user.lastCommentAt ? formatLocalDate(new Date(user.lastCommentAt), DATE_FORMAT, config) : '—'}
                  </span>
                </div>
                <Separator className="my-2" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">最近 IP</span>
                  <span className="break-all">{user.lastIp ?? '—'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">最近 User-Agent</span>
                  <span className="text-xs break-all">{user.lastUa ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">注册时间</span>
                  <span>{formatLocalDate(new Date(user.createdAt), DATE_FORMAT, config)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>操作</CardTitle>
                <CardDescription>对该用户执行管理操作。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {user.id !== userId && user.role !== null && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="user-role">角色</Label>
                    <Select
                      value={roleDraft || user.role}
                      onValueChange={(value) => {
                        if (value === user.role) {
                          setRoleDraft('')
                          return
                        }
                        const nextRole = value as Role
                        setRoleDraft(nextRole)
                        setConfirm({
                          title: `修改角色为「${nextRole === 'admin' ? '管理员' : nextRole === 'author' ? '作者' : '访客'}」？`,
                          description: '修改角色后，该用户的所有会话将被强制登出。',
                          actionLabel: '确认修改',
                          destructive: false,
                          onConfirm: () => updateRoleMutation.mutate({ userId: user.id, role: nextRole }),
                        })
                      }}
                    >
                      <SelectTrigger id="user-role" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">管理员</SelectItem>
                        <SelectItem value="author">作者</SelectItem>
                        <SelectItem value="visitor">访客</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {user.role !== null && user.deletedAt === null && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setConfirm({
                        title: `发送重置邮件给 ${user.name}？`,
                        description: '用户将收到一封包含一次性重置链接的邮件。链接 15 分钟内有效。',
                        actionLabel: '发送',
                        destructive: false,
                        onConfirm: () => sendResetMutation.mutate({ email: user.email }),
                      })
                    }
                  >
                    <MailIcon /> 发送重置邮件
                  </Button>
                )}
                {user.role !== null && user.deletedAt === null && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setConfirm({
                        title: `强制 ${user.name} 全部登出？`,
                        description: '该用户在所有设备上的登录会话将立即被注销，下次访问需要重新登录。',
                        actionLabel: '强制登出',
                        destructive: true,
                        actionIcon: <LogOutIcon data-icon />,
                        onConfirm: () => revokeSessionsMutation.mutate({ userId: user.id }),
                      })
                    }
                  >
                    <LogOutIcon /> 强制全部登出
                  </Button>
                )}
                {user.role !== 'admin' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setConfirm({
                        title: user.isMuted ? '解除禁言？' : '禁言该用户？',
                        description: user.isMuted
                          ? '解除后该用户可以继续在站点发表评论。'
                          : '禁言后该用户无法再发表新的评论，但已有评论保持可见。',
                        actionLabel: user.isMuted ? '解除' : '禁言',
                        destructive: !user.isMuted,
                        // Mute uses speaker icons because the default
                        // destructive icon (`Trash2`) reads as "delete"
                        // and miscues the action.
                        actionIcon: user.isMuted ? <Volume2Icon data-icon /> : <VolumeOffIcon data-icon />,
                        onConfirm: () => muteMutation.mutate({ userId: user.id, muted: !user.isMuted }),
                      })
                    }
                  >
                    {user.isMuted ? (
                      <>
                        <Volume2Icon /> 解除禁言
                      </>
                    ) : (
                      <>
                        <VolumeOffIcon /> 禁言
                      </>
                    )}
                  </Button>
                )}
                {user.pendingCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setConfirm({
                        title: `审核全部 ${user.pendingCount} 条待审评论？`,
                        description: '所有待审核评论将立即通过审核并对所有访客可见。',
                        actionLabel: '通过',
                        destructive: false,
                        onConfirm: () => bulkApproveMutation.mutate({ userId: user.id }),
                      })
                    }
                  >
                    <CheckCheckIcon /> 通过全部待审 ({user.pendingCount})
                  </Button>
                )}
                {user.deletedAt ? (
                  <Button type="button" variant="outline" onClick={() => restoreMutation.mutate({ userId: user.id })}>
                    <RotateCcwIcon /> 恢复用户
                  </Button>
                ) : (
                  user.role !== 'admin' && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() =>
                        setConfirm({
                          title: '软删除该用户？',
                          description: '此操作为软删除，用户记录保留，但在统计与列表中默认隐藏。',
                          actionLabel: '删除',
                          destructive: true,
                          onConfirm: () => deleteMutation.mutate({ userId: user.id }),
                        })
                      }
                    >
                      <Trash2Icon /> 软删除用户
                    </Button>
                  )
                )}
                {user.commentCount > 0 && user.role !== 'admin' && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() =>
                      setConfirm({
                        title: '删除该用户全部评论？',
                        description: '此操作为软删除，可后续通过数据库恢复。',
                        actionLabel: '删除',
                        destructive: true,
                        onConfirm: () => bulkDeleteMutation.mutate({ userId: user.id }),
                      })
                    }
                  >
                    <Trash2Icon /> 删除其全部评论
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>编辑信息</CardTitle>
                <CardDescription>修改后立即对该用户在前后台的展示生效。</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    // Allow `null` so unticking the override checkbox
                    // can clear the column on save.
                    const payload: Record<string, string | null> = { name, email }
                    if (link) {
                      payload.link = link
                    }
                    if (badgeName) {
                      payload.badgeName = badgeName
                    }
                    if (badgeColor) {
                      payload.badgeColor = badgeColor
                    }
                    payload.badgeTextColor = useTextOverride ? badgeTextColor : null
                    updateMutation.mutate({ ...payload, userId: user.id })
                  }}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="user-name">用户名</Label>
                    <Input id="user-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="user-email">邮箱</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="user-link">网站链接</Label>
                    <Input
                      id="user-link"
                      type="url"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="user-badge-name">徽章名称</Label>
                    <Input
                      id="user-badge-name"
                      type="text"
                      value={badgeName}
                      onChange={(e) => setBadgeName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="user-badge-color">徽章颜色</Label>
                    <Input
                      id="user-badge-color"
                      type="color"
                      value={badgeColor}
                      onChange={(e) => setBadgeColor(e.target.value)}
                      className="h-9 p-1"
                    />
                  </div>
                  {/*
                   * Badge text-colour override. The default behaviour
                   * (checkbox unticked) keeps the historical WCAG
                   * auto-pick — which already lands on the right
                   * contrast for every preset palette — so admins only
                   * need to opt in when their custom palette wants a
                   * deliberately different colour.
                   */}
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="user-badge-text-color-toggle"
                        checked={useTextOverride}
                        onCheckedChange={(next) => setUseTextOverride(next === true)}
                      />
                      <Label htmlFor="user-badge-text-color-toggle" className="cursor-pointer font-normal">
                        自定义徽章字体颜色
                      </Label>
                      <span className="text-xs text-muted-foreground">未勾选时按背景自动选择黑/白对比色</span>
                    </div>
                    {useTextOverride && (
                      <div className="flex items-center gap-3">
                        <Input
                          id="user-badge-text-color"
                          type="color"
                          value={badgeTextColor}
                          onChange={(e) => setBadgeTextColor(e.target.value)}
                          className="h-9 w-20 p-1"
                        />
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: badgeColor || '#008c95',
                            color: badgeTextColor,
                          }}
                        >
                          {badgeName || '预览'}
                        </span>
                      </div>
                    )}
                  </div>
                  {updateError && <div className="text-sm text-destructive sm:col-span-2">{updateError}</div>}
                  <div className="flex justify-end gap-2 sm:col-span-2">
                    <Button type="submit" disabled={updateMutation.isPending}>
                      <SaveIcon data-icon /> {updateMutation.isPending ? '保存中…' : '保存'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>最近评论</span>
                  {comments.length > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">显示 {comments.length} 条</span>
                  )}
                </CardTitle>
                <CardDescription>最近 10 条评论；点击文章标题可跳转到评论详情。</CardDescription>
              </CardHeader>
              <CardContent>
                {commentsQuery.isPending && comments.length === 0 ? (
                  <Skeleton className="h-32 w-full" />
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">该用户暂无评论。</p>
                ) : (
                  // Truncate each parsed-markdown body to ~3 lines so all 10
                  // entries fit visually without one long-form comment pushing
                  // the rest off the fold. Click-through to the moderation
                  // page reveals the full content.
                  <ul className="flex flex-col gap-3">
                    {comments.map((c) => (
                      <li key={idStr(c.id)} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {c.pageTitle && c.pagePublicId && (
                            <Link
                              to={`/wp-admin/comments?pageKey=${encodeURIComponent(c.pagePublicId)}`}
                              className="font-medium hover:underline"
                            >
                              {c.pageTitle}
                            </Link>
                          )}
                          <span className="text-muted-foreground">
                            {c.createAt && formatLocalDate(c.createAt, DATE_FORMAT, config)}
                          </span>
                          {c.isPending && <Badge variant="destructive">待审核</Badge>}
                        </div>
                        <div className="comment-content prose-blog prose prose-sm mt-1 line-clamp-3 max-w-none text-sm leading-snug wrap-break-word whitespace-normal [&>*]:!my-0">
                          <PortableTextBody body={c.body} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminListPage>

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}

function UserDetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardContent className="flex flex-col items-center gap-3">
          <Skeleton className="size-20 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
