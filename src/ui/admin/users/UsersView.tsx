import { MailIcon, Volume2Icon, VolumeOffIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  AdminMutationSuccessOutput,
  AdminUserDto,
  BulkApproveOutput,
  BulkSoftDeleteOutput,
  ListUsersInput,
  ListUsersOutput,
  MuteUserInput,
  MuteUserOutput,
  UserIdInput,
} from '@/shared/users'

import { useAdminMutation } from '@/client/api/use-admin-mutation'
import { API_ACTIONS } from '@/shared/api-actions'
import { AdminListPage } from '@/ui/admin/shared/AdminListPage'
import { type ConfirmState, ConfirmDialog } from '@/ui/admin/shared/ConfirmDialog'
import { useDebouncedSearch } from '@/ui/admin/shared/useDebouncedSearch'
import { InviteAuthorDialog } from '@/ui/admin/users/InviteAuthorDialog'
import { UsersTable } from '@/ui/admin/users/UsersTable'
import { UsersToolbar } from '@/ui/admin/users/UsersToolbar'
import { useUsersController } from '@/ui/admin/users/useUsersController'
import { Button } from '@/ui/components/button'
import { useSiteIdentity } from '@/ui/lib/blog-config-context'

const LIST = API_ACTIONS.admin.listUsers
const SOFT_DELETE = API_ACTIONS.admin.softDeleteUser
const RESTORE = API_ACTIONS.admin.restoreUser
const MUTE = API_ACTIONS.admin.muteUser
const BULK_APPROVE = API_ACTIONS.admin.bulkApproveUserComments
const BULK_DELETE = API_ACTIONS.admin.bulkSoftDeleteUserComments

// Orchestrator. Owns fetcher state, the controller dispatch, the
// confirm-dialog reducer, and effect wiring. Presentation lives in
// `UsersToolbar` (filter row + bulk actions) and `UsersTable`
// (header + rows + skeleton + empty state). Splitting the file keeps
// each concern under ~200 LOC and lets the row component memoize
// against parent re-renders triggered by an unrelated fetcher tick.
export function UsersView() {
  const config = useSiteIdentity()
  const { state, dispatch } = useUsersController()

  const listApi = useAdminMutation<ListUsersInput, ListUsersOutput>(LIST, {
    errorMessage: '加载用户列表失败',
    onSuccess: (payload) => {
      dispatch({ type: 'loaded', rows: payload.users, total: payload.total, hasMore: payload.hasMore })
    },
  })
  const muteApi = useAdminMutation<MuteUserInput, MuteUserOutput>(MUTE, {
    onSuccess: (payload) => {
      dispatch({ type: 'patchUser', user: payload.user })
    },
  })
  const { load: loadUsers, isPending: isUsersLoading } = listApi
  const { submit: submitMuteApi } = muteApi

  // Debounce search input — fire one list request 300 ms after the last
  // keystroke instead of one per character.
  const [qInput, setQInput] = useDebouncedSearch({
    delayMs: 300,
    onChange: (value) => dispatch({ type: 'setQ', value }),
  })

  const reload = useCallback(() => {
    loadUsers({
      offset: state.currentPage * state.pageSize,
      limit: state.pageSize,
      q: state.q || undefined,
      role: state.role !== 'all' ? state.role : undefined,
      includeDeleted: state.includeDeleted ? true : undefined,
      sortBy: state.sortBy !== 'recent' ? state.sortBy : undefined,
    })
  }, [loadUsers, state.currentPage, state.pageSize, state.q, state.role, state.includeDeleted, state.sortBy])

  const deleteApi = useAdminMutation<UserIdInput, AdminMutationSuccessOutput>(SOFT_DELETE, { onSuccess: reload })
  const restoreApi = useAdminMutation<UserIdInput, AdminMutationSuccessOutput>(RESTORE, { onSuccess: reload })
  const bulkApproveApi = useAdminMutation<UserIdInput, BulkApproveOutput>(BULK_APPROVE, { onSuccess: reload })
  const bulkDeleteApi = useAdminMutation<UserIdInput, BulkSoftDeleteOutput>(BULK_DELETE, { onSuccess: reload })
  const { submit: submitDeleteApi } = deleteApi
  const { submit: submitRestoreApi } = restoreApi
  const { submit: submitBulkApproveApi } = bulkApproveApi
  const { submit: submitBulkDeleteApi } = bulkDeleteApi

  useEffect(() => {
    reload()
  }, [reload])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(state.total / state.pageSize)), [state.total, state.pageSize])

  const selectedIds = useMemo(() => Object.keys(state.selected).filter((id) => state.selected[id]), [state.selected])
  const allRowsSelected = state.rows.length > 0 && state.rows.every((u) => state.selected[u.id])

  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  // Per-row action openers. Each one routes through `setConfirm` so
  // destructive operations always require an explicit user
  // confirmation; the matching `submit*Api` only fires on
  // `onConfirm`.
  const onMuteToggle = useCallback(
    (user: AdminUserDto) =>
      setConfirm({
        title: user.isMuted ? '解除该用户禁言？' : '禁言该用户？',
        description: user.isMuted
          ? '解除后该用户可以继续在站点发表评论。'
          : '禁言后该用户无法再发表新的评论，但已有评论保持可见。',
        actionLabel: user.isMuted ? '解除' : '禁言',
        destructive: !user.isMuted,
        // Speaker icons keep the action recognisable — the default
        // `Trash2` for destructive confirms reads as "delete" and
        // miscues 禁言.
        actionIcon: user.isMuted ? <Volume2Icon data-icon /> : <VolumeOffIcon data-icon />,
        onConfirm: () => submitMuteApi({ userId: user.id, muted: !user.isMuted }),
      }),
    [submitMuteApi],
  )
  const onSoftDelete = useCallback(
    (user: AdminUserDto) =>
      setConfirm({
        title: '删除该用户？',
        description: '此操作为软删除，用户记录保留，但在统计与列表中默认隐藏。',
        actionLabel: '删除',
        destructive: true,
        onConfirm: () => submitDeleteApi({ userId: user.id }),
      }),
    [submitDeleteApi],
  )
  const onRestore = useCallback((user: AdminUserDto) => submitRestoreApi({ userId: user.id }), [submitRestoreApi])
  const onBulkApproveOne = useCallback(
    (user: AdminUserDto) =>
      setConfirm({
        title: '审核该用户全部待审评论？',
        description: '所有待审核评论将立即通过审核并对所有访客可见。',
        actionLabel: '通过',
        destructive: false,
        onConfirm: () => submitBulkApproveApi({ userId: user.id }),
      }),
    [submitBulkApproveApi],
  )
  const onBulkDeleteCommentsOne = useCallback(
    (user: AdminUserDto) =>
      setConfirm({
        title: '删除该用户全部评论？',
        description: '此操作为软删除，可后续通过数据库恢复。',
        actionLabel: '删除',
        destructive: true,
        onConfirm: () => submitBulkDeleteApi({ userId: user.id }),
      }),
    [submitBulkDeleteApi],
  )

  const onSelectedChange = useCallback(
    (id: string, value: boolean) => dispatch({ type: 'setSelected', id, value }),
    [dispatch],
  )
  const onToggleAll = useCallback((value: boolean) => dispatch({ type: 'toggleAll', value }), [dispatch])

  const onBulkApproveSelected = useCallback(
    () =>
      setConfirm({
        title: `批量审核 ${selectedIds.length} 名用户的全部待审评论？`,
        description: '所选用户的所有待审核评论将立即通过审核并对所有访客可见。',
        actionLabel: '通过',
        destructive: false,
        onConfirm: () => {
          for (const id of selectedIds) {
            submitBulkApproveApi({ userId: id })
          }
          dispatch({ type: 'clearSelection' })
        },
      }),
    [selectedIds, submitBulkApproveApi, dispatch],
  )
  const onBulkDeleteSelected = useCallback(
    () =>
      setConfirm({
        title: `批量删除 ${selectedIds.length} 名用户的全部评论？`,
        description: '所选用户的所有评论将被软删除，可在后续通过数据库恢复。',
        actionLabel: '删除',
        destructive: true,
        onConfirm: () => {
          for (const id of selectedIds) {
            submitBulkDeleteApi({ userId: id })
          }
          dispatch({ type: 'clearSelection' })
        },
      }),
    [selectedIds, submitBulkDeleteApi, dispatch],
  )

  return (
    <>
      <AdminListPage>
        <AdminListPage.Header title="用户管理" description="管理评论用户：搜索、过滤、禁言、批量审核或软删除评论。">
          <Button type="button" variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
            <MailIcon /> 邀请作者
          </Button>
        </AdminListPage.Header>

        <UsersToolbar
          qInput={qInput}
          role={state.role}
          sortBy={state.sortBy}
          pageSize={state.pageSize}
          includeDeleted={state.includeDeleted}
          selectedCount={selectedIds.length}
          onSearchChange={setQInput}
          onRoleChange={(value) => dispatch({ type: 'setRole', value })}
          onSortByChange={(value) => dispatch({ type: 'setSortBy', value })}
          onPageSizeChange={(value) => dispatch({ type: 'setPageSize', value })}
          onIncludeDeletedChange={(value) => dispatch({ type: 'setIncludeDeleted', value })}
          onBulkApprove={onBulkApproveSelected}
          onBulkDelete={onBulkDeleteSelected}
        />

        <AdminListPage.Body>
          <UsersTable
            rows={state.rows}
            config={config}
            selected={state.selected}
            allRowsSelected={allRowsSelected}
            isLoading={isUsersLoading}
            onToggleAll={onToggleAll}
            onSelectedChange={onSelectedChange}
            onMuteToggle={onMuteToggle}
            onSoftDelete={onSoftDelete}
            onRestore={onRestore}
            onBulkApproveOne={onBulkApproveOne}
            onBulkDeleteCommentsOne={onBulkDeleteCommentsOne}
          />
        </AdminListPage.Body>

        <AdminListPage.PageNavigation
          totalPages={totalPages}
          currentPage={state.currentPage}
          onChange={(page) => dispatch({ type: 'setPage', value: page })}
        />
      </AdminListPage>

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
      <InviteAuthorDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={reload} />
    </>
  )
}
