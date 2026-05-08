import { CheckCheckIcon, SearchIcon, Trash2Icon } from 'lucide-react'

import type { RoleFilter, SortOrder } from '@/ui/admin/users/useUsersController'

import { AdminListPage } from '@/ui/admin/shared/AdminListPage'
import { Button } from '@/ui/components/ui/button'
import { Checkbox } from '@/ui/components/ui/checkbox'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select'

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

interface UsersToolbarProps {
  qInput: string
  role: RoleFilter
  sortBy: SortOrder
  pageSize: number
  includeDeleted: boolean
  selectedCount: number
  onSearchChange: (value: string) => void
  onRoleChange: (value: RoleFilter) => void
  onSortByChange: (value: SortOrder) => void
  onPageSizeChange: (value: number) => void
  onIncludeDeletedChange: (value: boolean) => void
  onBulkApprove: () => void
  onBulkDelete: () => void
}

// Filter row + bulk-actions tray. Pure props; the orchestrator owns
// the debounced search input and the confirm-dialog wiring (handlers
// are called only after the user has confirmed).
export function UsersToolbar({
  qInput,
  role,
  sortBy,
  pageSize,
  includeDeleted,
  selectedCount,
  onSearchChange,
  onRoleChange,
  onSortByChange,
  onPageSizeChange,
  onIncludeDeletedChange,
  onBulkApprove,
  onBulkDelete,
}: UsersToolbarProps) {
  return (
    <AdminListPage.Toolbar>
      <div className="grid gap-3 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <AdminListPage.FilterField label="搜索（姓名 / 邮箱）">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={qInput}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="输入用户名或邮箱"
              />
            </InputGroup>
          </AdminListPage.FilterField>
        </div>
        <AdminListPage.FilterField label="角色">
          <Select
            items={ROLE_OPTIONS}
            value={role}
            onValueChange={(value) => onRoleChange((value ?? 'all') as RoleFilter)}
          >
            <SelectTrigger className="w-full">
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
        </AdminListPage.FilterField>
        <AdminListPage.FilterField label="排序">
          <Select
            items={SORT_OPTIONS}
            value={sortBy}
            onValueChange={(value) => onSortByChange((value ?? 'recent') as SortOrder)}
          >
            <SelectTrigger className="w-full">
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
        </AdminListPage.FilterField>
        <AdminListPage.FilterField label="每页显示">
          <Select
            items={PAGE_SIZE_OPTIONS}
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number.parseInt(value ?? '10', 10))}
          >
            <SelectTrigger className="w-full">
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
        </AdminListPage.FilterField>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Checkbox
            id="users-include-deleted"
            checked={includeDeleted}
            onCheckedChange={(value) => onIncludeDeletedChange(value === true)}
          />
          <label htmlFor="users-include-deleted" className="text-sm select-none">
            包含已删除用户
          </label>
        </div>
        {selectedCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">已选 {selectedCount} 人</span>
            <Button type="button" variant="outline" size="sm" onClick={onBulkApprove}>
              <CheckCheckIcon /> 批量通过
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={onBulkDelete}>
              <Trash2Icon /> 批量删除评论
            </Button>
          </div>
        )}
      </div>
    </AdminListPage.Toolbar>
  )
}
