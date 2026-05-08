import { ExternalLinkIcon, FilePenIcon, PlusIcon, RefreshCwIcon, SearchIcon, Trash2Icon, Undo2Icon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'

import type {
  AdminPageDto,
  DeletePageInput,
  DeletePageOutput,
  ListPagesInput,
  ListPagesOutput,
  RestorePageInput,
  RestorePageOutput,
} from '@/shared/cms-pages'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { EditPageDialog } from '@/ui/admin/pages/EditPageDialog'
import { usePagesController } from '@/ui/admin/pages/usePagesController'
import { AdminListPage } from '@/ui/admin/shared/AdminListPage'
import { type ConfirmState, ConfirmDialog } from '@/ui/admin/shared/ConfirmDialog'
import { useDebouncedSearch } from '@/ui/admin/shared/useDebouncedSearch'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Card } from '@/ui/components/ui/card'
import { Checkbox } from '@/ui/components/ui/checkbox'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/ui/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/components/ui/input-group'
import { Skeleton } from '@/ui/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/ui/table'

const LIST = API_ACTIONS.admin.listPages
const DELETE = API_ACTIONS.admin.deletePage
const RESTORE = API_ACTIONS.admin.restorePage

type EditTarget = AdminPageDto | null | undefined

// Pages admin page orchestrator. Owns the controller dispatch, the
// edit dialog state, and the soft-delete / restore flow. The body
// editor lives at `/wp-admin/pages/:id/edit` and is reached from the
// row's "编辑内容" button — that route is built in a follow-up
// milestone.
export function PagesView() {
  const { state, dispatch } = usePagesController()
  const [editTarget, setEditTarget] = useState<EditTarget>(undefined)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  const listApi = useApiFetcher<ListPagesInput, ListPagesOutput>(LIST, {
    onSuccess: (payload) => dispatch({ type: 'loaded', rows: payload.pages, total: payload.total }),
    onError: (error) => console.error('[admin] list pages failed', error),
  })
  const { load: loadPages, isPending: isListPending } = listApi

  const reload = useCallback(() => {
    loadPages({
      q: state.q || undefined,
      includeDeleted: state.includeDeleted || undefined,
    })
  }, [loadPages, state.q, state.includeDeleted])

  const deleteApi = useApiFetcher<DeletePageInput, DeletePageOutput>(DELETE, {
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

  const restoreApi = useApiFetcher<RestorePageInput, RestorePageOutput>(RESTORE, {
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

  useEffect(() => {
    reload()
  }, [reload])

  const isLoading = isListPending && state.rows.length === 0

  return (
    <>
      <AdminListPage>
        <AdminListPage.Header
          title="页面管理"
          description={`共 ${state.total} 个页面。页面正文以 PortableText 形式存储在数据库；点击「编辑内容」可进入富文本编辑器。`}
        >
          <Button type="button" variant="outline" onClick={reload} disabled={isListPending}>
            <RefreshCwIcon /> 刷新
          </Button>
          <Button type="button" onClick={() => setEditTarget(null)}>
            <PlusIcon /> 新建页面
          </Button>
        </AdminListPage.Header>

        <AdminListPage.Toolbar>
          <div className="grid gap-3 sm:grid-cols-3">
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
            <div className="flex items-end gap-2 text-sm">
              <Checkbox
                id="pages-include-deleted"
                checked={state.includeDeleted}
                onCheckedChange={(value) => dispatch({ type: 'setIncludeDeleted', value: value === true })}
              />
              <label htmlFor="pages-include-deleted" className="text-sm select-none">
                包含已删除页面
              </label>
            </div>
          </div>
        </AdminListPage.Toolbar>

        <AdminListPage.Body>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">slug / 标题</TableHead>
                  <TableHead className="hidden md:table-cell">摘要</TableHead>
                  <TableHead className="w-28 text-center">状态</TableHead>
                  <TableHead className="hidden w-44 lg:table-cell">更新时间</TableHead>
                  <TableHead className="w-48 pr-4 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <PagesSkeleton />
                ) : state.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <Empty className="border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <SearchIcon />
                          </EmptyMedia>
                          <EmptyTitle>未找到页面</EmptyTitle>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  state.rows.map((row) => (
                    <PageRow
                      key={row.id}
                      page={row}
                      onEditMeta={() => setEditTarget(row)}
                      onDelete={() =>
                        setConfirm({
                          title: `删除页面「${row.title}」？`,
                          description: '页面会被软删除（30 天内可恢复）。已发布的链接将立即返回 404。',
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
      </AdminListPage>

      <EditPageDialog
        page={editTarget}
        onClose={() => setEditTarget(undefined)}
        onSaved={(saved) => {
          if (editTarget === null) {
            dispatch({ type: 'prependPage', page: saved })
          } else {
            dispatch({ type: 'patchPage', page: saved })
          }
          setEditTarget(undefined)
        }}
      />

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}

interface PageRowProps {
  page: AdminPageDto
  onEditMeta: () => void
  onDelete: () => void
  onRestore: () => void
}

function PageRow({ page, onEditMeta, onDelete, onRestore }: PageRowProps) {
  const isDeleted = page.deletedAt !== null
  return (
    <TableRow className={isDeleted ? 'opacity-60' : undefined}>
      <TableCell className="pl-4 align-top">
        <div className="font-medium">{page.title}</div>
        <div className="font-mono text-xs text-muted-foreground">/{page.slug}</div>
      </TableCell>
      <TableCell className="hidden max-w-md md:table-cell">
        <p className="line-clamp-2 text-sm text-muted-foreground">{page.summary || '—'}</p>
      </TableCell>
      <TableCell className="text-center align-top">
        <StatusBadge page={page} />
      </TableCell>
      <TableCell className="hidden align-top text-sm lg:table-cell">
        {new Date(page.updatedAt).toLocaleString('zh-CN')}
      </TableCell>
      <TableCell className="pr-4 text-right align-top">
        <div className="flex justify-end gap-2">
          {!isDeleted ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                title="在新窗口预览"
                render={
                  <Link to={`/${page.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLinkIcon />
                  </Link>
                }
              />
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link to={`/wp-admin/pages/${page.id}/edit`}>
                    <FilePenIcon /> 编辑内容
                  </Link>
                }
              />
              <Button variant="ghost" size="sm" onClick={onEditMeta} title="编辑元数据">
                信息
              </Button>
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

function StatusBadge({ page }: { page: AdminPageDto }) {
  if (page.deletedAt !== null) {
    return <Badge variant="destructive">已删除</Badge>
  }
  if (!page.published) {
    return <Badge variant="secondary">未发布</Badge>
  }
  if (page.publishedRevisionId === null) {
    return <Badge variant="outline">仅草稿</Badge>
  }
  return <Badge>已发布</Badge>
}

function PagesSkeleton() {
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
