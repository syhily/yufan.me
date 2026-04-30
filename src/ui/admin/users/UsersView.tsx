import {
  CheckCheckIcon,
  EyeIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  RotateCcwIcon,
  SearchIcon,
  ShieldIcon,
  Trash2Icon,
  VolumeOffIcon,
  Volume2Icon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link, useFetcher } from 'react-router'

import type {
  AdminMutationSuccessOutput,
  AdminUserDto,
  BulkApproveOutput,
  BulkSoftDeleteOutput,
  ListUsersOutput,
  MuteUserOutput,
} from '@/client/api/action-types'

import { API_ACTIONS } from '@/client/api/actions'
import { formatLocalDate } from '@/shared/formatter'
import { safeHref } from '@/shared/safe-url'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/admin/shadcn/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/admin/shadcn/components/ui/avatar'
import { Badge } from '@/ui/admin/shadcn/components/ui/badge'
import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { Card, CardContent } from '@/ui/admin/shadcn/components/ui/card'
import { Checkbox } from '@/ui/admin/shadcn/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/admin/shadcn/components/ui/dropdown-menu'
import { Input } from '@/ui/admin/shadcn/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/ui/admin/shadcn/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/admin/shadcn/components/ui/select'
import { Skeleton } from '@/ui/admin/shadcn/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/admin/shadcn/components/ui/table'

interface ApiEnvelope<T> {
  data?: T
  error?: { message: string }
}

const LIST = API_ACTIONS.admin.listUsers
const SOFT_DELETE = API_ACTIONS.admin.softDeleteUser
const RESTORE = API_ACTIONS.admin.restoreUser
const MUTE = API_ACTIONS.admin.muteUser
const BULK_APPROVE = API_ACTIONS.admin.bulkApproveUserComments
const BULK_DELETE = API_ACTIONS.admin.bulkSoftDeleteUserComments

const DATE_FORMAT = 'yyyy-LL-dd HH:mm'

type RoleFilter = 'all' | 'admin' | 'normal'
type SortOrder = 'recent' | 'commentCount'

// Base UI's `Select.Value` reads its display text from the matching entry in
// `Select.Root`'s `items` prop. Without that map it would render the raw
// value string (e.g. `"all"` or `"20"`), so each Select on this page passes
// a static `items` array alongside its `<SelectItem>` JSX. The two stay in
// sync because the JSX is rendered from the same array.
const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'admin', label: '仅管理员' },
  { value: 'normal', label: '仅普通用户' },
]

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'recent', label: '最新注册' },
  { value: 'commentCount', label: '评论数（高 → 低）' },
]

const PAGE_SIZE_OPTIONS: { value: string; label: string }[] = [10, 20, 50, 100].map((n) => ({
  value: String(n),
  label: `${n} 条`,
}))

interface UsersState {
  rows: AdminUserDto[]
  total: number
  hasMore: boolean
  currentPage: number
  pageSize: number
  q: string
  role: RoleFilter
  sortBy: SortOrder
  includeDeleted: boolean
  selected: Record<string, boolean>
}

type UsersAction =
  | { type: 'loaded'; rows: AdminUserDto[]; total: number; hasMore: boolean }
  | { type: 'setQ'; value: string }
  | { type: 'setRole'; value: RoleFilter }
  | { type: 'setSortBy'; value: SortOrder }
  | { type: 'setIncludeDeleted'; value: boolean }
  | { type: 'setPage'; value: number }
  | { type: 'setPageSize'; value: number }
  | { type: 'patchUser'; user: AdminUserDto }
  | { type: 'removeUser'; id: string }
  | { type: 'setSelected'; id: string; value: boolean }
  | { type: 'clearSelection' }
  | { type: 'toggleAll'; value: boolean }

function reducer(state: UsersState, action: UsersAction): UsersState {
  switch (action.type) {
    case 'loaded':
      return { ...state, rows: action.rows, total: action.total, hasMore: action.hasMore, selected: {} }
    case 'setQ':
      return { ...state, q: action.value, currentPage: 0 }
    case 'setRole':
      return { ...state, role: action.value, currentPage: 0 }
    case 'setSortBy':
      return { ...state, sortBy: action.value, currentPage: 0 }
    case 'setIncludeDeleted':
      return { ...state, includeDeleted: action.value, currentPage: 0 }
    case 'setPage':
      return { ...state, currentPage: action.value }
    case 'setPageSize':
      return { ...state, pageSize: action.value, currentPage: 0 }
    case 'patchUser':
      return {
        ...state,
        rows: state.rows.map((u) => (u.id === action.user.id ? { ...u, ...action.user } : u)),
      }
    case 'removeUser':
      return { ...state, rows: state.rows.filter((u) => u.id !== action.id) }
    case 'setSelected':
      return { ...state, selected: { ...state.selected, [action.id]: action.value } }
    case 'clearSelection':
      return { ...state, selected: {} }
    case 'toggleAll': {
      const next: Record<string, boolean> = {}
      if (action.value) {
        for (const u of state.rows) next[u.id] = true
      }
      return { ...state, selected: next }
    }
  }
}

export function UsersView() {
  const [state, dispatch] = useReducer(reducer, {
    rows: [],
    total: 0,
    hasMore: false,
    currentPage: 0,
    pageSize: 20,
    q: '',
    role: 'all',
    sortBy: 'recent',
    includeDeleted: false,
    selected: {},
  })

  const listFetcher = useFetcher<ApiEnvelope<ListUsersOutput>>()
  const muteFetcher = useFetcher<ApiEnvelope<MuteUserOutput>>()
  const deleteFetcher = useFetcher<ApiEnvelope<AdminMutationSuccessOutput>>()
  const restoreFetcher = useFetcher<ApiEnvelope<AdminMutationSuccessOutput>>()
  const bulkApproveFetcher = useFetcher<ApiEnvelope<BulkApproveOutput>>()
  const bulkDeleteFetcher = useFetcher<ApiEnvelope<BulkSoftDeleteOutput>>()

  // Debounce search input — fire one list request 300 ms after the last
  // keystroke instead of one per character.
  const [qInput, setQInput] = useState('')
  useEffect(() => {
    const id = window.setTimeout(() => dispatch({ type: 'setQ', value: qInput }), 300)
    return () => window.clearTimeout(id)
  }, [qInput])

  // React Router's `useFetcher()` hands back a fresh wrapper object on every
  // render, so closing over `listFetcher` in `useCallback` deps would re-fire
  // every render and trigger "Maximum update depth exceeded". Keep the
  // fetcher reference in a ref and depend only on user-controlled state.
  const listFetcherRef = useRef(listFetcher)
  listFetcherRef.current = listFetcher

  const reload = useCallback(() => {
    const params = new URLSearchParams()
    params.set('offset', String(state.currentPage * state.pageSize))
    params.set('limit', String(state.pageSize))
    if (state.q) params.set('q', state.q)
    if (state.role !== 'all') params.set('role', state.role)
    if (state.includeDeleted) params.set('includeDeleted', 'true')
    if (state.sortBy !== 'recent') params.set('sortBy', state.sortBy)
    void listFetcherRef.current.load(`${LIST.path}?${params.toString()}`)
  }, [state.currentPage, state.pageSize, state.q, state.role, state.includeDeleted, state.sortBy])

  useEffect(() => {
    reload()
  }, [reload])

  const lastHandled = useRef<unknown>(null)
  useEffect(() => {
    if (listFetcher.state !== 'idle' || !listFetcher.data) return
    if (listFetcher.data === lastHandled.current) return
    lastHandled.current = listFetcher.data
    if (listFetcher.data.error) {
      console.error('[admin] list users failed', listFetcher.data.error)
      return
    }
    const payload = listFetcher.data.data
    if (!payload) return
    dispatch({ type: 'loaded', rows: payload.users, total: payload.total, hasMore: payload.hasMore })
  }, [listFetcher.state, listFetcher.data])

  // Apply mutation results back to the row that was just changed so the
  // UI updates without waiting for the next full reload.
  useEffect(() => {
    if (muteFetcher.state !== 'idle' || !muteFetcher.data?.data) return
    dispatch({ type: 'patchUser', user: muteFetcher.data.data.user })
  }, [muteFetcher.state, muteFetcher.data])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(state.total / state.pageSize)), [state.total, state.pageSize])

  const selectedIds = useMemo(() => Object.keys(state.selected).filter((id) => state.selected[id]), [state.selected])
  const allRowsSelected = state.rows.length > 0 && state.rows.every((u) => state.selected[u.id])

  const [confirm, setConfirm] = useState<{
    title: string
    description: string
    actionLabel: string
    destructive: boolean
    onConfirm: () => void
  } | null>(null)

  const submitMute = (user: AdminUserDto, muted: boolean) => {
    void muteFetcher.submit(
      { userId: user.id, muted: muted ? 'true' : 'false' },
      { method: MUTE.method, encType: 'application/json', action: MUTE.path },
    )
  }
  const submitDelete = (user: AdminUserDto) => {
    void deleteFetcher.submit(
      { userId: user.id },
      { method: SOFT_DELETE.method, encType: 'application/json', action: SOFT_DELETE.path },
    )
  }
  const submitRestore = (user: AdminUserDto) => {
    void restoreFetcher.submit(
      { userId: user.id },
      { method: RESTORE.method, encType: 'application/json', action: RESTORE.path },
    )
  }

  // After bulk operations + delete + restore complete, reload to get the
  // fresh comment counts / deletion state from the backend.
  useEffect(() => {
    if (deleteFetcher.state !== 'idle' || !deleteFetcher.data?.data) return
    reload()
  }, [deleteFetcher.state, deleteFetcher.data, reload])
  useEffect(() => {
    if (restoreFetcher.state !== 'idle' || !restoreFetcher.data?.data) return
    reload()
  }, [restoreFetcher.state, restoreFetcher.data, reload])
  useEffect(() => {
    if (bulkApproveFetcher.state !== 'idle' || !bulkApproveFetcher.data?.data) return
    reload()
  }, [bulkApproveFetcher.state, bulkApproveFetcher.data, reload])
  useEffect(() => {
    if (bulkDeleteFetcher.state !== 'idle' || !bulkDeleteFetcher.data?.data) return
    reload()
  }, [bulkDeleteFetcher.state, bulkDeleteFetcher.data, reload])

  const isLoading = listFetcher.state !== 'idle'

  return (
    <>
      <div className="tw:flex tw:flex-col tw:gap-6">
        <header className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
          <div>
            <h1 className="tw:text-2xl tw:font-semibold tw:tracking-tight">用户管理</h1>
            <p className="tw:text-muted-foreground tw:text-sm">
              管理评论用户：搜索、过滤、禁言、批量审核或软删除评论。
            </p>
          </div>
        </header>

        <Card>
          <CardContent className="tw:flex tw:flex-col tw:gap-4">
            <div className="tw:grid tw:gap-3 tw:sm:grid-cols-5">
              <div className="tw:flex tw:flex-col tw:gap-1.5 tw:sm:col-span-2">
                <span className="tw:text-muted-foreground tw:text-xs">搜索（姓名 / 邮箱）</span>
                <div className="tw:relative">
                  <SearchIcon className="tw:text-muted-foreground tw:absolute tw:top-1/2 tw:left-2.5 tw:size-4 tw:-translate-y-1/2" />
                  <Input
                    type="search"
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                    placeholder="输入用户名或邮箱"
                    className="tw:pl-8"
                  />
                </div>
              </div>
              <div className="tw:flex tw:flex-col tw:gap-1.5 tw:sm:col-span-1">
                <span className="tw:text-muted-foreground tw:text-xs">角色</span>
                <Select
                  items={ROLE_OPTIONS}
                  value={state.role}
                  onValueChange={(value) => dispatch({ type: 'setRole', value: (value ?? 'all') as RoleFilter })}
                >
                  <SelectTrigger className="tw:w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="tw:flex tw:flex-col tw:gap-1.5 tw:sm:col-span-1">
                <span className="tw:text-muted-foreground tw:text-xs">排序</span>
                <Select
                  items={SORT_OPTIONS}
                  value={state.sortBy}
                  onValueChange={(value) => dispatch({ type: 'setSortBy', value: (value ?? 'recent') as SortOrder })}
                >
                  <SelectTrigger className="tw:w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="tw:flex tw:flex-col tw:gap-1.5 tw:sm:col-span-1">
                <span className="tw:text-muted-foreground tw:text-xs">每页显示</span>
                <Select
                  items={PAGE_SIZE_OPTIONS}
                  value={String(state.pageSize)}
                  onValueChange={(value) =>
                    dispatch({ type: 'setPageSize', value: Number.parseInt(value ?? '20', 10) })
                  }
                >
                  <SelectTrigger className="tw:w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:text-sm">
              <div className="tw:flex tw:items-center tw:gap-2">
                <Checkbox
                  id="users-include-deleted"
                  checked={state.includeDeleted}
                  onCheckedChange={(value) => dispatch({ type: 'setIncludeDeleted', value: value === true })}
                />
                <label htmlFor="users-include-deleted" className="tw:text-sm tw:select-none">
                  包含已删除用户
                </label>
              </div>
              {selectedIds.length > 0 && (
                <div className="tw:flex tw:items-center tw:gap-2 tw:ml-auto">
                  <span className="tw:text-muted-foreground tw:text-xs">已选 {selectedIds.length} 人</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setConfirm({
                        title: `批量审核 ${selectedIds.length} 名用户的全部待审评论？`,
                        description: '所选用户的所有待审核评论将立即通过审核并对所有访客可见。',
                        actionLabel: '通过',
                        destructive: false,
                        onConfirm: () => {
                          for (const id of selectedIds) {
                            void bulkApproveFetcher.submit(
                              { userId: id },
                              { method: BULK_APPROVE.method, encType: 'application/json', action: BULK_APPROVE.path },
                            )
                          }
                          dispatch({ type: 'clearSelection' })
                        },
                      })
                    }
                  >
                    <CheckCheckIcon /> 批量通过
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      setConfirm({
                        title: `批量删除 ${selectedIds.length} 名用户的全部评论？`,
                        description: '所选用户的所有评论将被软删除，可在后续通过数据库恢复。',
                        actionLabel: '删除',
                        destructive: true,
                        onConfirm: () => {
                          for (const id of selectedIds) {
                            void bulkDeleteFetcher.submit(
                              { userId: id },
                              { method: BULK_DELETE.method, encType: 'application/json', action: BULK_DELETE.path },
                            )
                          }
                          dispatch({ type: 'clearSelection' })
                        },
                      })
                    }
                  >
                    <Trash2Icon /> 批量删除评论
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="tw:overflow-hidden tw:p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="tw:w-10 tw:px-3">
                  <Checkbox
                    checked={allRowsSelected}
                    onCheckedChange={(value) => dispatch({ type: 'toggleAll', value: value === true })}
                    aria-label="全选"
                  />
                </TableHead>
                <TableHead>用户</TableHead>
                <TableHead className="tw:hidden tw:md:table-cell">联系方式</TableHead>
                <TableHead className="tw:hidden tw:lg:table-cell">最近活动</TableHead>
                <TableHead className="tw:text-center">评论</TableHead>
                <TableHead className="tw:text-center">状态</TableHead>
                <TableHead className="tw:w-12 tw:text-right tw:pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <UsersSkeleton />
              ) : state.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="tw:py-12 tw:text-center">
                    <div className="tw:text-muted-foreground tw:flex tw:flex-col tw:items-center tw:gap-2 tw:text-sm">
                      <SearchIcon className="tw:size-6" />
                      未找到用户
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                state.rows.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    selected={!!state.selected[user.id]}
                    onSelectedChange={(value) => dispatch({ type: 'setSelected', id: user.id, value })}
                    onMuteToggle={() =>
                      setConfirm({
                        title: user.isMuted ? '解除该用户禁言？' : '禁言该用户？',
                        description: user.isMuted
                          ? '解除后该用户可以继续在站点发表评论。'
                          : '禁言后该用户无法再发表新的评论，但已有评论保持可见。',
                        actionLabel: user.isMuted ? '解除' : '禁言',
                        destructive: !user.isMuted,
                        onConfirm: () => submitMute(user, !user.isMuted),
                      })
                    }
                    onSoftDelete={() =>
                      setConfirm({
                        title: '删除该用户？',
                        description: '此操作为软删除，用户记录保留，但在统计与列表中默认隐藏。',
                        actionLabel: '删除',
                        destructive: true,
                        onConfirm: () => submitDelete(user),
                      })
                    }
                    onRestore={() => submitRestore(user)}
                    onBulkApprove={() =>
                      setConfirm({
                        title: '审核该用户全部待审评论？',
                        description: '所有待审核评论将立即通过审核并对所有访客可见。',
                        actionLabel: '通过',
                        destructive: false,
                        onConfirm: () =>
                          void bulkApproveFetcher.submit(
                            { userId: user.id },
                            { method: BULK_APPROVE.method, encType: 'application/json', action: BULK_APPROVE.path },
                          ),
                      })
                    }
                    onBulkDeleteComments={() =>
                      setConfirm({
                        title: '删除该用户全部评论？',
                        description: '此操作为软删除，可后续通过数据库恢复。',
                        actionLabel: '删除',
                        destructive: true,
                        onConfirm: () =>
                          void bulkDeleteFetcher.submit(
                            { userId: user.id },
                            { method: BULK_DELETE.method, encType: 'application/json', action: BULK_DELETE.path },
                          ),
                      })
                    }
                  />
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {totalPages > 1 && (
          <UsersPagination
            totalPages={totalPages}
            currentPage={state.currentPage}
            onChange={(page) => dispatch({ type: 'setPage', value: page })}
          />
        )}
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(next) => !next && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className={confirm?.destructive ? 'tw:bg-destructive tw:hover:bg-destructive/90' : undefined}
              onClick={() => {
                confirm?.onConfirm()
                setConfirm(null)
              }}
            >
              {confirm?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface UserRowProps {
  user: AdminUserDto
  selected: boolean
  onSelectedChange: (value: boolean) => void
  onMuteToggle: () => void
  onSoftDelete: () => void
  onRestore: () => void
  onBulkApprove: () => void
  onBulkDeleteComments: () => void
}

function UserRow({
  user,
  selected,
  onSelectedChange,
  onMuteToggle,
  onSoftDelete,
  onRestore,
  onBulkApprove,
  onBulkDeleteComments,
}: UserRowProps) {
  const initial = (user.name || user.email || '?').slice(0, 1).toUpperCase()
  const linkHref = safeHref(user.link)
  return (
    <TableRow data-state={selected ? 'selected' : undefined}>
      <TableCell className="tw:px-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onSelectedChange(value === true)}
          aria-label={`选择 ${user.name}`}
        />
      </TableCell>
      <TableCell>
        <div className="tw:flex tw:items-center tw:gap-3">
          <Avatar className="tw:size-9 tw:shrink-0">
            <AvatarImage src={`/images/avatar/${user.id}.png`} alt={user.name} />
            <AvatarFallback className="tw:bg-muted tw:text-xs tw:font-semibold">{initial}</AvatarFallback>
          </Avatar>
          <div className="tw:min-w-0">
            <div className="tw:flex tw:items-center tw:gap-2">
              <Link
                to={`/wp-admin/users/${user.id}`}
                prefetch="intent"
                className="tw:font-medium tw:hover:underline tw:truncate"
              >
                {user.name}
              </Link>
              {user.isAdmin && (
                <Badge variant="secondary" className="tw:gap-1">
                  <ShieldIcon className="tw:size-3" /> 管理员
                </Badge>
              )}
              {user.badgeName && (
                <Badge
                  className="tw:border-transparent"
                  style={{
                    backgroundColor: user.badgeColor || '#008c95',
                    // Honour the admin-set text-colour override; fall
                    // back to white for legacy rows without one — the
                    // public site applies a proper WCAG pick, this
                    // table just needs a non-jarring default.
                    color: user.badgeTextColor || '#fff',
                  }}
                >
                  {user.badgeName}
                </Badge>
              )}
            </div>
            <div className="tw:text-muted-foreground tw:text-xs tw:md:hidden tw:truncate">{user.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="tw:hidden tw:md:table-cell">
        <div className="tw:flex tw:flex-col tw:gap-0.5 tw:text-sm">
          <span className="tw:truncate">{user.email}</span>
          {linkHref && (
            <a
              href={linkHref}
              target="_blank"
              rel="nofollow noreferrer"
              className="tw:text-muted-foreground tw:hover:text-foreground tw:truncate tw:text-xs"
            >
              {linkHref}
            </a>
          )}
        </div>
      </TableCell>
      <TableCell className="tw:hidden tw:lg:table-cell">
        <div className="tw:text-muted-foreground tw:flex tw:flex-col tw:gap-0.5 tw:text-xs">
          {user.lastCommentAt && <span>评论：{formatLocalDate(new Date(user.lastCommentAt), DATE_FORMAT)}</span>}
          {user.lastIp && <span>IP：{user.lastIp}</span>}
          {user.lastUa && <span className="tw:max-w-xs tw:truncate">UA：{user.lastUa}</span>}
        </div>
      </TableCell>
      <TableCell className="tw:text-center">
        <Link to={`/wp-admin/comments?userId=${user.id}`} className="tw:hover:underline tw:text-sm tw:font-medium">
          {user.commentCount}
        </Link>
        {user.pendingCount > 0 && (
          <div className="tw:text-destructive tw:mt-0.5 tw:text-xs">{user.pendingCount} 待审</div>
        )}
      </TableCell>
      <TableCell className="tw:text-center">
        {user.deletedAt ? (
          <Badge variant="outline" className="tw:text-muted-foreground">
            已删除
          </Badge>
        ) : user.isMuted ? (
          <Badge variant="destructive">已禁言</Badge>
        ) : (
          <Badge variant="secondary">正常</Badge>
        )}
      </TableCell>
      <TableCell className="tw:pr-4 tw:text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="ghost" size="icon" aria-label="更多操作">
                <MoreHorizontalIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="tw:w-52">
            <DropdownMenuItem
              render={
                <Link to={`/wp-admin/users/${user.id}`}>
                  <EyeIcon /> 查看详情
                </Link>
              }
            />
            <DropdownMenuItem
              render={
                <Link to={`/wp-admin/comments?userId=${user.id}`}>
                  <MessageSquareIcon /> 查看其评论
                </Link>
              }
            />
            {!user.isAdmin && (
              <DropdownMenuItem onClick={onMuteToggle}>
                {user.isMuted ? (
                  <>
                    <Volume2Icon /> 解除禁言
                  </>
                ) : (
                  <>
                    <VolumeOffIcon /> 禁言
                  </>
                )}
              </DropdownMenuItem>
            )}
            {user.pendingCount > 0 && (
              <DropdownMenuItem onClick={onBulkApprove}>
                <CheckCheckIcon /> 通过全部待审 ({user.pendingCount})
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {user.deletedAt ? (
              <DropdownMenuItem onClick={onRestore}>
                <RotateCcwIcon /> 恢复用户
              </DropdownMenuItem>
            ) : (
              !user.isAdmin && (
                <DropdownMenuItem variant="destructive" onClick={onSoftDelete}>
                  <Trash2Icon /> 软删除用户
                </DropdownMenuItem>
              )
            )}
            {user.commentCount > 0 && !user.isAdmin && (
              <DropdownMenuItem variant="destructive" onClick={onBulkDeleteComments}>
                <Trash2Icon /> 删除其全部评论
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

function UsersSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell className="tw:px-3">
            <Skeleton className="tw:size-4 tw:rounded" />
          </TableCell>
          <TableCell colSpan={6}>
            <div className="tw:flex tw:items-center tw:gap-3">
              <Skeleton className="tw:size-9 tw:shrink-0 tw:rounded-full" />
              <Skeleton className="tw:h-4 tw:w-1/3" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

interface UsersPaginationProps {
  totalPages: number
  currentPage: number
  onChange: (page: number) => void
}

function UsersPagination({ totalPages, currentPage, onChange }: UsersPaginationProps) {
  const pages = useMemo(() => buildPageList(currentPage, totalPages), [currentPage, totalPages])
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious disabled={currentPage === 0} onClick={() => onChange(Math.max(0, currentPage - 1))} />
        </PaginationItem>
        {pages.map((p, i) =>
          p === '...' ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink isActive={p === currentPage} onClick={() => onChange(p)}>
                {p + 1}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            disabled={currentPage >= totalPages - 1}
            onClick={() => onChange(Math.min(totalPages - 1, currentPage + 1))}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

function buildPageList(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const pages: (number | '...')[] = [0]
  const left = Math.max(1, current - 1)
  const right = Math.min(total - 2, current + 1)
  if (left > 1) pages.push('...')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < total - 2) pages.push('...')
  pages.push(total - 1)
  return pages
}
