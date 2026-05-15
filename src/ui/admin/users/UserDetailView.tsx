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
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useFetcher } from 'react-router'

import type {
  AdminMutationSuccessOutput,
  AdminUserDto,
  BulkApproveOutput,
  BulkSoftDeleteOutput,
  GetUserOutput,
  LoadAllOutput,
  MuteUserOutput,
  UpdateUserOutput,
} from '@/client/api/fetcher'
import type { ApiEnvelope } from '@/client/api/fetcher'
import type { AdminComment } from '@/shared/comments'

import { API_ACTIONS, useFetcherResult } from '@/client/api/fetcher'
type Role = NonNullable<AdminUserDto['role']>
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

const GET = API_ACTIONS.admin.getUser
const UPDATE = API_ACTIONS.auth.updateUser
const UPDATE_ROLE = API_ACTIONS.admin.updateUserRole
// Initial colour offered when an admin first ticks the "自定义字体颜色"
// checkbox. Mirrors the public `--badge-text` light value so the picker
// lands on the most common choice rather than `#000000`.
const DEFAULT_BADGE_TEXT_COLOR = '#ffffff'
const MUTE = API_ACTIONS.admin.muteUser
const SEND_RESET = API_ACTIONS.admin.sendPasswordReset
const REVOKE_USER_SESSIONS = API_ACTIONS.admin.revokeUserSessions
const SOFT_DELETE = API_ACTIONS.admin.softDeleteUser
const RESTORE = API_ACTIONS.admin.restoreUser
const BULK_APPROVE = API_ACTIONS.admin.bulkApproveUserComments
const BULK_DELETE = API_ACTIONS.admin.bulkSoftDeleteUserComments
const COMMENTS_LOAD = API_ACTIONS.comment.loadAll

const DATE_FORMAT = 'yyyy-LL-dd HH:mm'

export interface UserDetailViewProps {
  userId: string
  navigate: NavigateFunction
}

export function UserDetailView({ userId, navigate }: UserDetailViewProps) {
  const config = useSiteIdentity()
  const userFetcher = useFetcher<ApiEnvelope<GetUserOutput>>()
  const updateFetcher = useFetcher<ApiEnvelope<UpdateUserOutput>>()
  const sendResetFetcher = useFetcher<ApiEnvelope<{ success: boolean }>>()
  const revokeSessionsFetcher = useFetcher<ApiEnvelope<{ success: boolean }>>()
  const muteFetcher = useFetcher<ApiEnvelope<MuteUserOutput>>()
  const deleteFetcher = useFetcher<ApiEnvelope<AdminMutationSuccessOutput>>()
  const restoreFetcher = useFetcher<ApiEnvelope<AdminMutationSuccessOutput>>()
  const bulkApproveFetcher = useFetcher<ApiEnvelope<BulkApproveOutput>>()
  const bulkDeleteFetcher = useFetcher<ApiEnvelope<BulkSoftDeleteOutput>>()
  const commentsFetcher = useFetcher<ApiEnvelope<LoadAllOutput>>()
  const updateRoleFetcher = useFetcher<ApiEnvelope<{ user: AdminUserDto }>>()

  const [user, setUser] = useState<AdminUserDto | null>(null)
  const [comments, setComments] = useState<AdminComment[]>([])
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

  // React Router's `useFetcher()` returns a fresh wrapper object on every
  // render. Closing over it directly in `useCallback` deps would re-fire
  // every render and trigger "Maximum update depth exceeded". Keep the
  // fetcher reference in a ref and depend only on `userId`.
  const userFetcherRef = useRef(userFetcher)
  userFetcherRef.current = userFetcher
  const commentsFetcherRef = useRef(commentsFetcher)
  commentsFetcherRef.current = commentsFetcher

  const reloadUser = useCallback(() => {
    void userFetcherRef.current.submit(
      { userId },
      { method: GET.method, encType: 'application/json', action: GET.path },
    )
  }, [userId])

  const reloadComments = useCallback(() => {
    void commentsFetcherRef.current.submit(
      { offset: 0, limit: 10, userId },
      { method: COMMENTS_LOAD.method, encType: 'application/json', action: COMMENTS_LOAD.path },
    )
  }, [userId])

  useEffect(() => {
    reloadUser()
    reloadComments()
  }, [reloadUser, reloadComments])

  // All eight `useFetcher`s used to drain via hand-rolled `useEffect`
  // blocks that closed over `reloadUser`/`reloadComments`/`navigate`.
  // Those closures changed identity on every render, so the effects
  // re-fired while `fetcher.data` was still set and triggered redundant
  // reload bursts. `useFetcherResult` ref-stashes the callbacks AND
  // memoises against the response identity, so each branch fires
  // exactly once per server response.
  useFetcherResult(userFetcher, {
    action: GET,
    onSuccess: (payload: GetUserOutput) => {
      const u = payload.user
      setUser(u)
      setName(u.name)
      setEmail(u.email)
      setLink(u.link ?? '')
      setBadgeName(u.badgeName ?? '')
      setBadgeColor(u.badgeColor ?? '#008c95')
      setUseTextOverride(u.badgeTextColor !== null)
      setBadgeTextColor(u.badgeTextColor ?? DEFAULT_BADGE_TEXT_COLOR)
    },
  })
  useFetcherResult(commentsFetcher, {
    action: COMMENTS_LOAD,
    onSuccess: (payload: LoadAllOutput) => setComments(payload.comments),
  })
  useFetcherResult(sendResetFetcher, { action: SEND_RESET, onSuccess: () => {} })
  useFetcherResult(revokeSessionsFetcher, { action: REVOKE_USER_SESSIONS, onSuccess: () => {} })
  useFetcherResult(updateFetcher, { action: UPDATE, onSuccess: () => reloadUser() })
  useFetcherResult(updateRoleFetcher, {
    action: UPDATE_ROLE,
    onSuccess: () => {
      setRoleDraft('')
    },
  })
  useFetcherResult(restoreFetcher, { action: RESTORE, onSuccess: () => reloadUser() })
  useFetcherResult(deleteFetcher, {
    action: SOFT_DELETE,
    onSuccess: () => void navigate('/wp-admin/users'),
  })
  useFetcherResult(bulkApproveFetcher, {
    action: BULK_APPROVE,
    onSuccess: () => {
      reloadUser()
      reloadComments()
    },
  })
  useFetcherResult(bulkDeleteFetcher, {
    action: BULK_DELETE,
    onSuccess: () => {
      reloadUser()
      reloadComments()
    },
  })

  if (!user) {
    return <UserDetailSkeleton />
  }

  const initial = (user.name || user.email || '?').slice(0, 1).toUpperCase()
  const updateError = updateFetcher.data?.error?.message

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
                          onConfirm: () =>
                            void updateRoleFetcher.submit(
                              { userId: user.id, role: nextRole },
                              { method: UPDATE_ROLE.method, encType: 'application/json', action: UPDATE_ROLE.path },
                            ),
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
                        onConfirm: () =>
                          void sendResetFetcher.submit(
                            { userId: user.id },
                            {
                              method: SEND_RESET.method,
                              encType: 'application/json',
                              action: SEND_RESET.path,
                            },
                          ),
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
                        onConfirm: () =>
                          void revokeSessionsFetcher.submit(
                            { userId: user.id },
                            {
                              method: REVOKE_USER_SESSIONS.method,
                              encType: 'application/json',
                              action: REVOKE_USER_SESSIONS.path,
                            },
                          ),
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
                        onConfirm: () =>
                          void muteFetcher.submit(
                            { userId: user.id, muted: user.isMuted ? 'false' : 'true' },
                            { method: MUTE.method, encType: 'application/json', action: MUTE.path },
                          ),
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
                        onConfirm: () =>
                          void bulkApproveFetcher.submit(
                            { userId: user.id },
                            {
                              method: BULK_APPROVE.method,
                              encType: 'application/json',
                              action: BULK_APPROVE.path,
                            },
                          ),
                      })
                    }
                  >
                    <CheckCheckIcon /> 通过全部待审 ({user.pendingCount})
                  </Button>
                )}
                {user.deletedAt ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      void restoreFetcher.submit(
                        { userId: user.id },
                        {
                          method: RESTORE.method,
                          encType: 'application/json',
                          action: RESTORE.path,
                        },
                      )
                    }
                  >
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
                          onConfirm: () =>
                            void deleteFetcher.submit(
                              { userId: user.id },
                              {
                                method: SOFT_DELETE.method,
                                encType: 'application/json',
                                action: SOFT_DELETE.path,
                              },
                            ),
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
                        onConfirm: () =>
                          void bulkDeleteFetcher.submit(
                            { userId: user.id },
                            {
                              method: BULK_DELETE.method,
                              encType: 'application/json',
                              action: BULK_DELETE.path,
                            },
                          ),
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
                    const payload: Record<string, string | null> = { userId: user.id, name, email }
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
                    void updateFetcher.submit(payload, {
                      method: UPDATE.method,
                      encType: 'application/json',
                      action: UPDATE.path,
                    })
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
                    <Button type="submit" disabled={updateFetcher.state !== 'idle'}>
                      <SaveIcon data-icon /> {updateFetcher.state !== 'idle' ? '保存中…' : '保存'}
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
                {commentsFetcher.state !== 'idle' && comments.length === 0 ? (
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
