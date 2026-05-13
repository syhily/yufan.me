import {
  ArrowDownIcon,
  ArrowUpIcon,
  FilePenIcon,
  MessageSquareIcon,
  PinIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  Undo2Icon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import type { AdminUserDto, ListUsersInput, ListUsersOutput } from '@/shared/api-types'
import type { ListCategoriesInput, ListCategoriesOutput } from '@/shared/categories'
import type {
  AdminPostDto,
  DeletePostInput,
  DeletePostOutput,
  ListPostsInput,
  ListPostsOutput,
  RestorePostInput,
  RestorePostOutput,
} from '@/shared/cms-posts'
import type { ListTagsInput, ListTagsOutput } from '@/shared/tags'

import { useAdminMutation } from '@/client/api/use-admin-mutation'
import { API_ACTIONS } from '@/shared/api-actions'
import { usePostsController } from '@/ui/admin/posts/usePostsController'
import { AdminListPage } from '@/ui/admin/shared/AdminListPage'
import { type ConfirmState, ConfirmDialog } from '@/ui/admin/shared/ConfirmDialog'
import { useDebouncedSearch } from '@/ui/admin/shared/useDebouncedSearch'
import { Badge } from '@/ui/components/badge'
import { Button } from '@/ui/components/button'
import { Card } from '@/ui/components/card'
import { Combobox, ComboboxContent, ComboboxItem, ComboboxTrigger, ComboboxValue } from '@/ui/components/combobox'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/ui/components/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/components/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select'
import { Skeleton } from '@/ui/components/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table'

const LIST = API_ACTIONS.admin.listPosts
const DELETE = API_ACTIONS.admin.deletePost
const RESTORE = API_ACTIONS.admin.restorePost
const LIST_CATEGORIES = API_ACTIONS.admin.listCategories
const LIST_TAGS = API_ACTIONS.admin.listTags
const LIST_USERS = API_ACTIONS.admin.listUsers

const DELETED_STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'normal', label: '正常' },
  { value: 'deleted', label: '已删除' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '未发布' },
  { value: 'hidden', label: '隐藏' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100].map((n) => ({
  value: String(n),
  label: `${n} 条`,
}))

const SORT_BY_OPTIONS = [
  { value: 'publishedAt', label: '首次发布时间' },
  { value: 'updatedAt', label: '最近更新时间' },
]

export function PostsView() {
  const { state, dispatch } = usePostsController()
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  const listApi = useAdminMutation<ListPostsInput, ListPostsOutput>(LIST, {
    onSuccess: (payload) => dispatch({ type: 'loaded', rows: payload.posts, total: payload.total }),
    errorMessage: '加载文章列表失败',
  })
  const { load: loadPosts, isPending: isListPending } = listApi

  const reload = useCallback(() => {
    loadPosts({
      q: state.q || undefined,
      deletedStatus: state.deletedStatus,
      offset: state.currentPage * state.pageSize,
      limit: state.pageSize,
      category: state.category || undefined,
      tag: state.tag || undefined,
      published: state.published,
      visible: state.visible,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
      authorId: state.authorId || undefined,
    })
  }, [
    loadPosts,
    state.q,
    state.deletedStatus,
    state.currentPage,
    state.pageSize,
    state.category,
    state.tag,
    state.published,
    state.visible,
    state.sortBy,
    state.sortOrder,
    state.authorId,
  ])

  const deleteApi = useAdminMutation<DeletePostInput, DeletePostOutput>(DELETE, {
    onSuccess: () => reload(),
    onError: (error) =>
      setConfirm({
        title: '删除失败',
        description: error.message,
        actionLabel: '我知道了',
        destructive: false,
        onConfirm: () => undefined,
      }),
  })
  const { submit: submitDelete } = deleteApi

  const restoreApi = useAdminMutation<RestorePostInput, RestorePostOutput>(RESTORE, {
    onSuccess: () => reload(),
    onError: (error) =>
      setConfirm({
        title: '恢复失败',
        description: error.message,
        actionLabel: '我知道了',
        destructive: false,
        onConfirm: () => undefined,
      }),
  })
  const { submit: submitRestore } = restoreApi

  const [qInput, setQInput] = useDebouncedSearch({
    delayMs: 300,
    onChange: (value) => dispatch({ type: 'setQ', value }),
  })

  // Load filter option data
  const categoriesApi = useAdminMutation<ListCategoriesInput, ListCategoriesOutput>(LIST_CATEGORIES, {
    onSuccess: () => undefined,
  })
  const tagsApi = useAdminMutation<ListTagsInput, ListTagsOutput>(LIST_TAGS, {
    onSuccess: () => undefined,
  })
  const usersApi = useAdminMutation<ListUsersInput, ListUsersOutput>(LIST_USERS, {
    onSuccess: () => undefined,
  })

  useEffect(() => {
    categoriesApi.load({})
    tagsApi.load({ limit: 100 })
    usersApi.load({ limit: 100, hasPosts: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(state.total / state.pageSize)), [state.total, state.pageSize])

  const categories = categoriesApi.data?.categories
  const tags = tagsApi.data?.tags
  const users = usersApi.data?.users

  const categoryOptions = useMemo(
    () => [{ value: '', label: '全部分类' }, ...(categories ?? []).map((c) => ({ value: c.name, label: c.name }))],
    [categories],
  )
  const tagNames = useMemo(() => ['', ...(tags ?? []).map((t) => t.name)], [tags])
  const authorOptions = useMemo(
    () => [
      { value: '', label: '全部作者' },
      ...(users ?? []).map((u: AdminUserDto) => ({ value: u.id, label: u.name })),
    ],
    [users],
  )

  const isLoading = isListPending && state.rows.length === 0

  return (
    <>
      <AdminListPage>
        <AdminListPage.Header
          title="文章管理"
          description={`共 ${state.total} 篇文章。点击「编辑」可进入富文本编辑器，编辑器右侧可同时调整文章元数据。`}
        >
          <Button type="button" variant="outline" onClick={reload} disabled={isListPending}>
            <RefreshCwIcon /> 刷新
          </Button>
          <Button
            type="button"
            render={
              <Link to="/wp-admin/posts/new">
                <PlusIcon /> 新建文章
              </Link>
            }
          />
        </AdminListPage.Header>

        <AdminListPage.Toolbar>
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="sm:col-span-2">
              <AdminListPage.FilterField label="搜索（slug / 标题）">
                <InputGroup>
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="search"
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                    placeholder="输入 slug 或标题关键字"
                  />
                </InputGroup>
              </AdminListPage.FilterField>
            </div>
            <AdminListPage.FilterField label="删除状态">
              <Select
                items={DELETED_STATUS_OPTIONS}
                value={state.deletedStatus}
                onValueChange={(value) =>
                  dispatch({ type: 'setDeletedStatus', value: (value ?? 'normal') as 'all' | 'deleted' | 'normal' })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELETED_STATUS_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AdminListPage.FilterField>
            <AdminListPage.FilterField label="发布状态">
              <Select
                items={STATUS_OPTIONS}
                value={state.status}
                onValueChange={(value) => {
                  dispatch({ type: 'setStatus', value: (value ?? 'all') as 'all' | 'published' | 'draft' | 'hidden' })
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((item) => (
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
                value={String(state.pageSize)}
                onValueChange={(value) => dispatch({ type: 'setPageSize', value: Number.parseInt(value ?? '20', 10) })}
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
          <div className="grid gap-3 sm:grid-cols-4">
            <AdminListPage.FilterField label="分类">
              <Select
                items={categoryOptions}
                value={state.category}
                onValueChange={(value) => dispatch({ type: 'setCategory', value: value ?? '' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AdminListPage.FilterField>
            <AdminListPage.FilterField label="标签">
              <Combobox
                items={tagNames}
                value={state.tag}
                onValueChange={(value) => dispatch({ type: 'setTag', value: value ?? '' })}
              >
                <ComboboxTrigger className="w-full">
                  <ComboboxValue placeholder="全部标签" />
                </ComboboxTrigger>
                <ComboboxContent<string> inputPlaceholder="搜索标签…" emptyMessage="无匹配标签">
                  {(item) => (
                    <ComboboxItem key={item} value={item}>
                      {item === '' ? '全部标签' : item}
                    </ComboboxItem>
                  )}
                </ComboboxContent>
              </Combobox>
            </AdminListPage.FilterField>
            <AdminListPage.FilterField label="作者">
              <Select
                items={authorOptions}
                value={state.authorId}
                onValueChange={(value) => dispatch({ type: 'setAuthorId', value: value ?? '' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {authorOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AdminListPage.FilterField>
            <AdminListPage.FilterField label="排序">
              <div className="flex gap-2">
                <Select
                  items={SORT_BY_OPTIONS}
                  value={state.sortBy}
                  onValueChange={(value) =>
                    dispatch({ type: 'setSortBy', value: (value ?? 'publishedAt') as 'publishedAt' | 'updatedAt' })
                  }
                >
                  <SelectTrigger className="grow">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_BY_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={state.sortOrder === 'desc' ? '降序' : '升序'}
                  onClick={() => dispatch({ type: 'setSortOrder', value: state.sortOrder === 'desc' ? 'asc' : 'desc' })}
                >
                  {state.sortOrder === 'desc' ? <ArrowDownIcon /> : <ArrowUpIcon />}
                </Button>
              </div>
            </AdminListPage.FilterField>
          </div>
        </AdminListPage.Toolbar>

        <AdminListPage.Body>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">标题</TableHead>
                  <TableHead className="hidden md:table-cell">分类</TableHead>
                  <TableHead className="hidden w-24 text-center md:table-cell">作者</TableHead>
                  <TableHead className="w-28 text-center">状态</TableHead>
                  <TableHead className="hidden w-44 lg:table-cell">发布时间</TableHead>
                  <TableHead className="w-56 pr-4 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <PostsSkeleton />
                ) : state.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <Empty className="border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <SearchIcon />
                          </EmptyMedia>
                          <EmptyTitle>未找到文章</EmptyTitle>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  state.rows.map((row) => (
                    <PostRow
                      key={row.id}
                      post={row}
                      onDelete={() =>
                        setConfirm({
                          title: `删除文章「${row.title}」？`,
                          description: '文章会被软删除（30 天内可恢复）。已发布的链接将立即返回 404。',
                          actionLabel: '删除',
                          destructive: true,
                          onConfirm: () => submitDelete({ id: row.id }),
                        })
                      }
                      onRestore={() => submitRestore({ id: row.id })}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </AdminListPage.Body>

        <AdminListPage.PageNavigation
          totalPages={totalPages}
          currentPage={state.currentPage}
          onChange={(page) => dispatch({ type: 'setCurrentPage', value: page })}
        />
      </AdminListPage>

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}

interface PostRowProps {
  post: AdminPostDto
  onDelete: () => void
  onRestore: () => void
}

function PostRow({ post, onDelete, onRestore }: PostRowProps) {
  const isDeleted = post.deletedAt !== null
  return (
    <TableRow className={isDeleted ? 'opacity-60' : undefined}>
      <TableCell className="pl-4 align-top">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{post.title}</span>
          {post.pinnedAt !== null && (
            <span title="已置顶">
              <PinIcon className="size-3.5 text-status-warn-fg" />
            </span>
          )}
        </div>
        <Link
          to={`/posts/${post.slug}`}
          className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          /posts/{post.slug}
        </Link>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <p className="text-sm text-muted-foreground">{post.category || '—'}</p>
      </TableCell>
      <TableCell className="hidden w-24 text-center align-middle md:table-cell">
        <p className="text-sm text-muted-foreground">{post.authorName || '—'}</p>
      </TableCell>
      <TableCell className="text-center align-middle">
        <StatusBadge post={post} />
      </TableCell>
      <TableCell className="hidden align-middle text-sm lg:table-cell">
        {new Date(post.firstPublishedAt ?? post.publishedAt).toLocaleString('zh-CN')}
      </TableCell>
      <TableCell className="pr-4 text-right align-top">
        <div className="flex justify-end gap-2">
          {!isDeleted ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                title="查看评论"
                className="w-20 justify-start"
                render={
                  <Link to={`/wp-admin/comments?pageKey=${encodeURIComponent(post.commentPublicId)}`}>
                    <MessageSquareIcon /> {post.commentCount}
                  </Link>
                }
              />
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link to={`/wp-admin/posts/${post.id}/edit`}>
                    <FilePenIcon /> 编辑
                  </Link>
                }
              />
              <Button variant="ghost" size="sm" onClick={onDelete} title="删除">
                <Trash2Icon />
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onRestore} title="恢复">
              <Undo2Icon /> 恢复
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

function StatusBadge({ post }: { post: AdminPostDto }) {
  if (post.deletedAt !== null) {
    return <Badge variant="destructive">已删除</Badge>
  }
  if (!post.published) {
    return <Badge variant="secondary">未发布</Badge>
  }
  if (post.publishedRevisionId === null) {
    return <Badge variant="outline">仅草稿</Badge>
  }
  if (!post.visible) {
    return <Badge variant="outline">隐藏</Badge>
  }
  return <Badge>已发布</Badge>
}

function PostsSkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <TableRow key={i}>
          <TableCell className="pl-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-20" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="h-3 w-full" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="mx-auto h-3 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="mx-auto h-5 w-16" />
          </TableCell>
          <TableCell className="hidden lg:table-cell">
            <Skeleton className="h-3 w-32" />
          </TableCell>
          <TableCell className="pr-4">
            <Skeleton className="ml-auto h-8 w-32" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
