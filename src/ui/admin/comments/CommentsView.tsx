import { RefreshCwIcon, SearchIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import type {
  FilterAutocompleteInput,
  LoadAllInput,
  LoadAllOutput,
  SearchAuthorsOutput,
  SearchPagesOutput,
} from '@/shared/api-types'
import type { AdminComment } from '@/shared/comments'
import type { FilterItem, FilterStatus } from '@/ui/admin/comments/useCommentsController'

import { useAdminMutation } from '@/client/api/use-admin-mutation'
import { API_ACTIONS } from '@/shared/api-actions'
import { idStr } from '@/shared/tools'
import { AdminCommentRow } from '@/ui/admin/comments/AdminCommentRow'
import { EditCommentDialog } from '@/ui/admin/comments/EditCommentDialog'
import { EditUserDialog } from '@/ui/admin/comments/EditUserDialog'
import { ReplyCommentDialog } from '@/ui/admin/comments/ReplyCommentDialog'
import { useCommentsController } from '@/ui/admin/comments/useCommentsController'
import { AdminListPage } from '@/ui/admin/shared/AdminListPage'
import { type ConfirmState, ConfirmDialog } from '@/ui/admin/shared/ConfirmDialog'
import { useDebouncedSearch } from '@/ui/admin/shared/useDebouncedSearch'
import { Button } from '@/ui/components/ui/button'
import { Card, CardContent } from '@/ui/components/ui/card'
import { Combobox, ComboboxContent, ComboboxItem, ComboboxTrigger, ComboboxValue } from '@/ui/components/ui/combobox'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/ui/components/ui/empty'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select'
import { Skeleton } from '@/ui/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/ui/components/ui/tabs'

const LOAD_ALL = API_ACTIONS.comment.loadAll
const SEARCH_PAGES = API_ACTIONS.comment.searchPages
const SEARCH_AUTHORS = API_ACTIONS.comment.searchAuthors

// How long to wait after the user stops typing in a Combobox input
// before firing the autocomplete request. 250ms feels snappy without
// firing on every keystroke for slow-typing CJK IMEs.
const FILTER_QUERY_DEBOUNCE_MS = 250

const PAGE_SIZE_OPTIONS: { value: string; label: string }[] = [10, 20, 50, 100].map((n) => ({
  value: String(n),
  label: `${n} 条`,
}))

// Tiny "X 清除" affordance shown next to a filter label whenever that
// filter is non-empty. Uses the `destructive-soft` Button variant
// (light-pink bg, magenta text) so it visually telegraphs "removes a
// selection" without yelling at the user. Kept small (`size="sm"` plus
// shorter horizontal padding via `px-2`) so it fits neatly on the
// header row above each Combobox without inflating the row height.
function ClearFilterButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="destructive-soft"
      size="sm"
      onClick={onClick}
      className="h-7 gap-1 px-2 py-0 text-xs"
    >
      <XIcon data-icon="sm" />
      清除
    </Button>
  )
}

export interface CommentsViewProps {
  commentCsrfToken: string
  currentUserName: string
  currentUserEmail: string
}

export function CommentsView({ commentCsrfToken, currentUserName, currentUserEmail }: CommentsViewProps) {
  const [searchParams] = useSearchParams()
  const initialAuthorId = searchParams.get('userId') ?? ''
  const initialPageKey = searchParams.get('pageKey') ?? ''
  const initialStatus = (searchParams.get('status') as FilterStatus | null) ?? 'all'
  const { state, dispatch, filterPageKey, filterAuthorId } = useCommentsController({
    initialAuthorId,
    initialPageKey,
    initialStatus,
  })

  const loadApi = useAdminMutation<LoadAllInput, LoadAllOutput>(LOAD_ALL, {
    errorMessage: '加载评论列表失败',
    onSuccess: (payload) => {
      dispatch({
        type: 'loaded',
        comments: payload.comments,
        total: payload.total,
        hasMore: payload.hasMore,
        statusCounts: payload.statusCounts,
      })
    },
  })
  const pagesApi = useAdminMutation<FilterAutocompleteInput, SearchPagesOutput>(SEARCH_PAGES)
  const authorsApi = useAdminMutation<FilterAutocompleteInput, SearchAuthorsOutput>(SEARCH_AUTHORS)
  const authorRehydrateApi = useAdminMutation<FilterAutocompleteInput, SearchAuthorsOutput>(SEARCH_AUTHORS, {
    onSuccess: (payload) => {
      const fetched = payload.authors
      if (fetched.length === 0) {
        return
      }
      // The endpoint returns up to N matches but for `ids=<single>` we
      // only ever care about the first row (and `searchAuthors` honours
      // `inArray(user.id, ids)`, so any returned row is by definition a
      // valid match for one of our ids).
      dispatch({ type: 'renameFilterAuthor', label: fetched[0].name })
    },
  })
  const pageRehydrateApi = useAdminMutation<FilterAutocompleteInput, SearchPagesOutput>(SEARCH_PAGES, {
    onSuccess: (payload) => {
      const fetched = payload.pages
      if (fetched.length === 0) {
        return
      }
      const title = fetched[0].title || '无标题'
      dispatch({ type: 'renameFilterPage', label: title })
    },
  })
  const { submit: loadComments, isPending: isCommentsLoading } = loadApi
  const { load: loadPages, data: pagesData, isPending: isPagesPending } = pagesApi
  const { load: loadAuthors, data: authorsData, isPending: isAuthorsPending } = authorsApi
  const { load: rehydrateAuthor } = authorRehydrateApi
  const { load: rehydratePage } = pageRehydrateApi

  const [editTarget, setEditTarget] = useState<AdminComment | null>(null)
  const [replyTarget, setReplyTarget] = useState<AdminComment | null>(null)
  const [editUserTarget, setEditUserTarget] = useState<AdminComment | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [replyCsrfToken, setReplyCsrfToken] = useState(commentCsrfToken)

  useEffect(() => {
    setReplyCsrfToken(commentCsrfToken)
  }, [commentCsrfToken])

  /*
   * Mount-only: if the page was opened with `?userId=2232` we have a
   * Combobox value but no human label, so the trigger renders the bare
   * id ("2232"). Fire one lookup against `searchAuthors?ids=2232` to
   * resolve the matching `name` and rename the filter label. Subsequent
   * label updates triggered by the user's own selection are handled
   * directly inside `onValueChange`, so this effect never needs to run
   * again — the empty deps array enforces that.
   */
  useEffect(() => {
    if (!initialAuthorId) {
      return
    }
    rehydrateAuthor({ ids: initialAuthorId })
  }, [initialAuthorId, rehydrateAuthor])

  // Page-key flavour of the same rehydrate dance. See the matching
  // author-rehydrate block above for the rationale; the only material
  // difference is the wire format (`?key=<single>` rather than
  // `?ids=<csv>`) because page keys are URL strings that aren't
  // comma-safe.
  useEffect(() => {
    if (!initialPageKey) {
      return
    }
    rehydratePage({ key: initialPageKey })
  }, [initialPageKey, rehydratePage])

  const reload = useCallback(() => {
    const offset = state.currentPage * state.pageSize
    loadComments({
      offset,
      limit: state.pageSize,
      ...(filterPageKey ? { pageKey: filterPageKey } : {}),
      ...(filterAuthorId ? { userId: filterAuthorId } : {}),
      ...(state.filterStatus !== 'all' ? { status: state.filterStatus } : {}),
    })
  }, [loadComments, state.currentPage, state.pageSize, filterPageKey, filterAuthorId, state.filterStatus])

  useEffect(() => {
    reload()
  }, [reload])

  // --- Lazy-loaded filter dropdowns ---------------------------------
  //
  // The two filter Comboboxes (page-title, author-name) used to load
  // every option in one shot at mount time. That doesn't scale to large
  // sites, and Base UI's client-side filter had an edge case where the
  // selected item leaked through as an empty row. Now: each Combobox
  // owns a `pageQuery`/`authorQuery` controlled-input string, every
  // change is debounced for `FILTER_QUERY_DEBOUNCE_MS`, and the matching
  // server endpoint returns the top-N hits. We pass `filter={null}` to
  // Base UI so it doesn't re-filter on top of what we already filtered
  // server-side.
  const [pageQuery, setPageQuery] = useDebouncedSearch({
    delayMs: FILTER_QUERY_DEBOUNCE_MS,
    onChange: (value) => {
      loadPages(value ? { q: value } : undefined)
    },
  })
  const [authorQuery, setAuthorQuery] = useDebouncedSearch({
    delayMs: FILTER_QUERY_DEBOUNCE_MS,
    onChange: (value) => {
      loadAuthors(value ? { q: value } : undefined)
    },
  })

  // Server-returned items, normalised to `{ value, label }` so Base UI
  // Combobox can auto-display labels via `Combobox.Value`. We also splice
  // the currently selected item back in (when not present in the latest
  // server response) so Base UI's "selected indicator" can still find a
  // match in the rendered list — otherwise the check-mark would silently
  // disappear when the user starts typing a query that excludes their
  // current selection.
  const pageItems = useMemo<FilterItem[]>(() => {
    const fetched = pagesData?.pages ?? []
    const items = fetched.map((p) => ({ value: p.key, label: p.title || '无标题' }))
    if (state.filterPage && !items.some((i) => i.value === state.filterPage!.value)) {
      items.unshift(state.filterPage)
    }
    return items
  }, [pagesData, state.filterPage])

  const authorItems = useMemo<FilterItem[]>(() => {
    const fetched = authorsData?.authors ?? []
    const items = fetched.map((a) => ({ value: a.id, label: a.name }))
    if (state.filterAuthor && !items.some((i) => i.value === state.filterAuthor!.value)) {
      items.unshift(state.filterAuthor)
    }
    return items
  }, [authorsData, state.filterAuthor])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(state.total / state.pageSize)), [state.total, state.pageSize])

  const askApprove = useCallback(
    (run: () => void) =>
      setConfirm({
        title: '审核通过该评论？',
        description: '审核通过后评论会立即对所有访客可见，并向作者发送通知邮件。',
        actionLabel: '通过',
        destructive: false,
        onConfirm: run,
      }),
    [],
  )
  const askDelete = useCallback(
    (run: () => void) =>
      setConfirm({
        title: '删除该评论？',
        description: '此操作不可撤销，删除后评论从前后台彻底消失。',
        actionLabel: '删除',
        destructive: true,
        onConfirm: run,
      }),
    [],
  )

  const isLoading = isCommentsLoading

  return (
    <>
      <AdminListPage>
        <AdminListPage.Header title="评论管理" description="审核、回复、编辑站点评论。">
          <Button type="button" variant="outline" onClick={reload} disabled={isLoading}>
            <RefreshCwIcon data-icon="inline-start" /> 刷新
          </Button>
        </AdminListPage.Header>

        <AdminListPage.Toolbar>
          <Tabs
            value={state.filterStatus}
            onValueChange={(value) => dispatch({ type: 'setFilterStatus', value: value as FilterStatus })}
          >
            <TabsList>
              <TabsTrigger value="all">全部 · {state.statusCounts.all}</TabsTrigger>
              <TabsTrigger value="pending">待审核 · {state.statusCounts.pending}</TabsTrigger>
              <TabsTrigger value="approved">已审核 · {state.statusCounts.approved}</TabsTrigger>
            </TabsList>
          </Tabs>
          {/*
           * Filter row. The `FilterField` compound owns the label-row alignment
           * (fixed 28px) so the three controls below stay aligned even when only
           * one column has a "X 清除" button visible.
           */}
          <div className="grid gap-3 sm:grid-cols-3">
            <AdminListPage.FilterField
              label="筛选文章"
              action={
                state.filterPage ? (
                  <ClearFilterButton onClick={() => dispatch({ type: 'setFilterPage', value: null })} />
                ) : undefined
              }
            >
              <Combobox<FilterItem>
                items={pageItems}
                value={state.filterPage}
                onValueChange={(item) => dispatch({ type: 'setFilterPage', value: item })}
                inputValue={pageQuery}
                onInputValueChange={(value) => setPageQuery(value)}
                filter={null}
              >
                <ComboboxTrigger className="w-full">
                  <ComboboxValue placeholder="全部文章" />
                </ComboboxTrigger>
                <ComboboxContent<FilterItem>
                  inputPlaceholder="搜索文章…"
                  emptyMessage={isPagesPending ? '加载中…' : '无匹配文章'}
                >
                  {(item) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxContent>
              </Combobox>
            </AdminListPage.FilterField>
            <AdminListPage.FilterField
              label="筛选评论人员"
              action={
                state.filterAuthor ? (
                  <ClearFilterButton onClick={() => dispatch({ type: 'setFilterAuthor', value: null })} />
                ) : undefined
              }
            >
              <Combobox<FilterItem>
                items={authorItems}
                value={state.filterAuthor}
                onValueChange={(item) => dispatch({ type: 'setFilterAuthor', value: item })}
                inputValue={authorQuery}
                onInputValueChange={(value) => setAuthorQuery(value)}
                filter={null}
              >
                <ComboboxTrigger className="w-full">
                  <ComboboxValue placeholder="全部人员" />
                </ComboboxTrigger>
                <ComboboxContent<FilterItem>
                  inputPlaceholder="搜索人员…"
                  emptyMessage={isAuthorsPending ? '加载中…' : '无匹配人员'}
                >
                  {(item) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxContent>
              </Combobox>
            </AdminListPage.FilterField>
            <AdminListPage.FilterField label="每页显示">
              <Select
                items={PAGE_SIZE_OPTIONS}
                value={String(state.pageSize)}
                onValueChange={(value) => dispatch({ type: 'setPageSize', value: Number.parseInt(value ?? '10', 10) })}
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
        </AdminListPage.Toolbar>

        <AdminListPage.Body>
          <div className="flex flex-col gap-3">
            {isLoading ? (
              <CommentsSkeleton />
            ) : state.comments.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SearchIcon />
                  </EmptyMedia>
                  <EmptyTitle>暂无评论</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              state.comments.map((comment) => (
                <AdminCommentRow
                  key={idStr(comment.id)}
                  comment={comment}
                  onEdit={() => setEditTarget(comment)}
                  onReply={() => setReplyTarget(comment)}
                  onEditUser={() => setEditUserTarget(comment)}
                  onApproved={() => dispatch({ type: 'approveComment', id: idStr(comment.id) })}
                  onDeleted={() => dispatch({ type: 'removeComment', id: idStr(comment.id) })}
                  onConfirmApprove={askApprove}
                  onConfirmDelete={askDelete}
                  onFilterByPage={(pageKey, pageTitle) => {
                    dispatch({ type: 'setFilterPage', value: { value: pageKey, label: pageTitle } })
                    if (typeof window !== 'undefined') {
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                  }}
                  onFilterByAuthor={(userId, name) => {
                    dispatch({ type: 'setFilterAuthor', value: { value: userId, label: name } })
                    if (typeof window !== 'undefined') {
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                  }}
                />
              ))
            )}
          </div>
        </AdminListPage.Body>

        <AdminListPage.PageNavigation
          totalPages={totalPages}
          currentPage={state.currentPage}
          onChange={(page) => dispatch({ type: 'setCurrentPage', value: page })}
        />
      </AdminListPage>

      <EditCommentDialog
        comment={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={(c) => {
          if (editTarget) {
            dispatch({ type: 'updateCommentContent', id: idStr(editTarget.id), content: c.content })
          }
          setEditTarget(null)
        }}
      />
      <EditUserDialog
        comment={editUserTarget}
        onClose={() => setEditUserTarget(null)}
        onSaved={() => {
          setEditUserTarget(null)
          reload()
        }}
      />
      <ReplyCommentDialog
        comment={replyTarget}
        authorName={currentUserName || '管理员'}
        authorEmail={currentUserEmail}
        csrfToken={replyCsrfToken}
        onClose={() => setReplyTarget(null)}
        onReplied={() => {
          setReplyTarget(null)
          reload()
        }}
        onCsrfRotated={setReplyCsrfToken}
      />

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}

function CommentsSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex gap-4">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  )
}
