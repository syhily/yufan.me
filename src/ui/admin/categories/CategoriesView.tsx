import { PlusIcon, RefreshCwIcon, SearchIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type {
  AdminCategoryDto,
  DeleteCategoryInput,
  DeleteCategoryOutput,
  ListCategoriesOutput,
  ReorderCategoriesInput,
  ReorderCategoriesOutput,
} from '@/shared/categories'

import { api } from '@/client/api/client'
import { useApiMutation, useApiQuery } from '@/client/api/query'
import { unwrap } from '@/client/api/unwrap'
import { CategoriesSkeleton, CategoryRow } from '@/ui/admin/categories/CategoryRow'
import { EditCategoryDialog } from '@/ui/admin/categories/EditCategoryDialog'
import { useCategoriesController } from '@/ui/admin/categories/useCategoriesController'
import { AdminListPage } from '@/ui/admin/shared/AdminListPage'
import { type ConfirmState, ConfirmDialog } from '@/ui/admin/shared/ConfirmDialog'
import { useDebouncedSearch } from '@/ui/admin/shared/useDebouncedSearch'
import { Button } from '@/ui/components/button'
import { Card } from '@/ui/components/card'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/ui/components/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ui/components/input-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table'

type EditTarget = AdminCategoryDto | null | undefined

// Categories admin page orchestrator. Owns the controller dispatch,
// the optimistic reorder pipeline, the edit / confirm dialog state,
// and the drag-source ref. Per-row presentation lives in
// `./CategoryRow.tsx`; the description cell and skeleton ride along
// in the same file because they're only ever rendered inside a
// `<CategoryRow>` table.
export function CategoriesView() {
  const { state, dispatch } = useCategoriesController()
  const [editTarget, setEditTarget] = useState<EditTarget>(undefined)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const listQuery = useApiQuery<ListCategoriesOutput>(['admin', 'listCategories', state.q], () =>
    unwrap(api.admin.categories.list({ query: { q: state.q || undefined } })),
  )

  useEffect(() => {
    if (listQuery.data) {
      dispatch({ type: 'loaded', rows: listQuery.data.categories, total: listQuery.data.total })
    }
  }, [listQuery.data])

  useEffect(() => {
    if (listQuery.error) {
      toast.error('加载分类失败', { description: listQuery.error.message })
    }
  }, [listQuery.error])

  const isListPending = listQuery.isFetching

  const reload = useCallback(() => {
    void listQuery.refetch()
  }, [listQuery])

  const deleteMutation = useApiMutation<DeleteCategoryInput, void>(
    (input) => unwrap(api.admin.categories.delete({ params: { id: input.id } })),
    {
      onSuccess: () => {
        toast.success('已删除分类')
      },
      onError: (error) => {
        setConfirm({
          title: '无法删除分类',
          description: error.message,
          actionLabel: '我知道了',
          destructive: false,
          onConfirm: () => undefined,
        })
      },
    },
  )
  const submitDelete = deleteMutation.mutate

  const reorderMutation = useApiMutation<ReorderCategoriesInput, ReorderCategoriesOutput>(
    (input) => unwrap(api.admin.categories.reorder({ body: input })),
    {
      onSuccess: (payload) => dispatch({ type: 'replaceRows', rows: payload.categories }),
      onError: (error) => {
        setConfirm({
          title: '排序保存失败',
          description: `${error.message}。已重新加载最新顺序。`,
          actionLabel: '我知道了',
          destructive: false,
          onConfirm: () => undefined,
        })
        reload()
      },
    },
  )
  const submitReorder = reorderMutation.mutate

  const [qInput, setQInput] = useDebouncedSearch({
    delayMs: 300,
    onChange: (value) => dispatch({ type: 'setQ', value }),
  })

  // DnD only operates on the live full list. With a search filter
  // applied the rows are a subset, and reordering a subset would
  // silently truncate or rewrite the unseen rows' sort_order. The
  // service guards against this server-side too, but we surface the
  // disable in the UI so admins don't see a drop that "fails".
  const dndEnabled = state.q.trim() === '' && state.rows.length > 1
  const isReorderPending = reorderMutation.isPending

  // The dragging row id is tracked in a ref to avoid re-rendering the
  // whole list on every dragover. `setDraggingId` only fires on drag
  // start / end so the dragged row gets its `opacity-50` styling.
  const dragOriginRef = useRef<string | null>(null)

  const onDragStart = useCallback((id: string) => {
    dragOriginRef.current = id
    setDraggingId(id)
  }, [])

  const onDragEnd = useCallback(() => {
    dragOriginRef.current = null
    setDraggingId(null)
  }, [])

  const onDropOnRow = useCallback(
    (targetId: string) => {
      const sourceId = dragOriginRef.current
      dragOriginRef.current = null
      setDraggingId(null)
      if (sourceId === null || sourceId === targetId) {
        return
      }
      const ids = state.rows.map((row) => row.id)
      const fromIndex = ids.indexOf(sourceId)
      const toIndex = ids.indexOf(targetId)
      if (fromIndex < 0 || toIndex < 0) {
        return
      }
      const next = ids.slice()
      next.splice(fromIndex, 1)
      next.splice(toIndex, 0, sourceId)
      // No-op when the drop lands on the row right next to the source —
      // splice yields the same sequence.
      if (next.every((id, index) => id === ids[index])) {
        return
      }
      dispatch({ type: 'reorderRows', orderedIds: next })
      submitReorder({ orderedIds: next })
    },
    [dispatch, state.rows, submitReorder],
  )

  const isLoading = isListPending && state.rows.length === 0

  return (
    <>
      <AdminListPage>
        <AdminListPage.Header
          title="分类管理"
          description={`共 ${state.total} 个分类。MDX 文章 frontmatter 中的 category 字段引用这些名称；拖拽行首手柄可调整顺序。`}
        >
          <Button type="button" variant="outline" className="border-ink-4" onClick={reload} disabled={isListPending}>
            <RefreshCwIcon /> 刷新
          </Button>
          <Button type="button" onClick={() => setEditTarget(null)}>
            <PlusIcon /> 新增分类
          </Button>
        </AdminListPage.Header>

        <AdminListPage.Toolbar>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <AdminListPage.FilterField label="搜索（名称 / slug / 简介）">
                <InputGroup>
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="search"
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                    placeholder="输入名称、URL slug 或简介关键字"
                  />
                </InputGroup>
              </AdminListPage.FilterField>
            </div>
          </div>
        </AdminListPage.Toolbar>

        <AdminListPage.Body>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-4" aria-label="拖拽排序" />
                  <TableHead className="w-20">封面</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead className="hidden lg:table-cell">简介</TableHead>
                  <TableHead className="w-20 text-center">排序</TableHead>
                  <TableHead className="w-20 text-center">文章</TableHead>
                  <TableHead className="w-12 pr-4 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <CategoriesSkeleton />
                ) : state.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <Empty className="border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <SearchIcon />
                          </EmptyMedia>
                          <EmptyTitle>未找到分类</EmptyTitle>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  state.rows.map((row) => (
                    <CategoryRow
                      key={row.id}
                      category={row}
                      dragEnabled={dndEnabled && !isReorderPending}
                      isDragging={draggingId === row.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDropOnRow={onDropOnRow}
                      onEdit={() => setEditTarget(row)}
                      onDelete={() =>
                        setConfirm({
                          title: `删除分类「${row.name}」？`,
                          description:
                            '此操作会从数据库直接删除该分类。如果仍有文章引用此分类，删除将被阻止；请先在 MDX frontmatter 中改写后再删除。',
                          actionLabel: '删除',
                          destructive: true,
                          onConfirm: () => submitDelete({ id: row.id }),
                        })
                      }
                    />
                  ))
                )}
              </TableBody>
            </Table>
            {!dndEnabled && state.q.trim() !== '' && state.rows.length > 1 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">清空搜索后即可拖拽调整顺序。</p>
            ) : null}
          </Card>
        </AdminListPage.Body>
      </AdminListPage>

      <EditCategoryDialog
        category={editTarget}
        onClose={() => setEditTarget(undefined)}
        onSaved={(saved) => {
          if (editTarget === null) {
            dispatch({ type: 'prependCategory', category: saved })
          } else {
            dispatch({ type: 'patchCategory', category: saved })
          }
          setEditTarget(undefined)
        }}
      />

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}
