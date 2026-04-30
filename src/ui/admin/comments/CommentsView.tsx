import { RefreshCwIcon, SearchIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useFetcher, useSearchParams } from 'react-router'

import type { LoadAllOutput, SearchAuthorsOutput, SearchPagesOutput } from '@/client/api/action-types'
import type { AdminComment } from '@/server/comments/types'

import { API_ACTIONS } from '@/client/api/actions'
import { idStr } from '@/shared/tools'
import { AdminCommentRow } from '@/ui/admin/comments/AdminCommentRow'
import { EditCommentDialog } from '@/ui/admin/comments/EditCommentDialog'
import { EditUserDialog } from '@/ui/admin/comments/EditUserDialog'
import { ReplyCommentDialog } from '@/ui/admin/comments/ReplyCommentDialog'
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
import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { Card, CardContent } from '@/ui/admin/shadcn/components/ui/card'
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxTrigger,
  ComboboxValue,
} from '@/ui/admin/shadcn/components/ui/combobox'
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
import { Tabs, TabsList, TabsTrigger } from '@/ui/admin/shadcn/components/ui/tabs'

interface ApiEnvelope<T> {
  data?: T
  error?: { message: string }
}

type FilterStatus = 'all' | 'pending' | 'approved'

// `FilterItem` is the shape Base UI Combobox treats specially: when an
// `items` array contains `{ value, label }` objects, `label` is auto-used
// in `Combobox.Value` / `Combobox.Input` and `value` is auto-used for
// the controlled `value` lookup. We carry the same shape inside reducer
// state so the trigger label survives without a second resolve roundtrip
// (e.g. when "来自：xxx" links from a comment row pre-fill the filter, we
// already know the title and can hand it to the Combobox directly).
interface FilterItem {
  value: string
  label: string
}

interface PageState {
  comments: AdminComment[]
  total: number
  hasMore: boolean
  currentPage: number
  pageSize: number
  filterStatus: FilterStatus
  filterPage: FilterItem | null
  filterAuthor: FilterItem | null
}

type PageAction =
  | { type: 'loaded'; comments: AdminComment[]; total: number; hasMore: boolean }
  | { type: 'removeComment'; id: string }
  | { type: 'approveComment'; id: string }
  | { type: 'updateCommentContent'; id: string; content: string }
  | { type: 'setFilterStatus'; value: FilterStatus }
  | { type: 'setFilterPage'; value: FilterItem | null }
  | { type: 'setFilterAuthor'; value: FilterItem | null }
  /*
   * `renameFilterAuthor` updates only the human-readable `label` of the
   * current author filter, keeping `value` (the user id) unchanged. Used
   * by the URL-restore path: when we land on
   * `/wp-admin/comments?userId=2232` we initially seed the filter with
   * `{ value: "2232", label: "2232" }` so the Combobox isn't blank, then
   * fire a one-shot lookup against `searchAuthors?ids=2232` and rename
   * the label to "雨帆" once the response comes back. Crucially this
   * must NOT reset `currentPage` (unlike `setFilterAuthor`) — the user
   * never picked a new filter, we're just decorating the existing one.
   */
  | { type: 'renameFilterAuthor'; label: string }
  | { type: 'setPageSize'; value: number }
  | { type: 'setCurrentPage'; value: number }

function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case 'loaded':
      return { ...state, comments: action.comments, total: action.total, hasMore: action.hasMore }
    case 'removeComment':
      return { ...state, comments: state.comments.filter((c) => idStr(c.id) !== action.id) }
    case 'approveComment':
      return {
        ...state,
        comments: state.comments.map((c) => (idStr(c.id) === action.id ? { ...c, isPending: false } : c)),
      }
    case 'updateCommentContent':
      return {
        ...state,
        comments: state.comments.map((c) => (idStr(c.id) === action.id ? { ...c, content: action.content } : c)),
      }
    case 'setFilterStatus':
      return { ...state, filterStatus: action.value, currentPage: 0 }
    case 'setFilterPage':
      return { ...state, filterPage: action.value, currentPage: 0 }
    case 'setFilterAuthor':
      return { ...state, filterAuthor: action.value, currentPage: 0 }
    case 'renameFilterAuthor':
      // Pure cosmetic label refresh — the value (user id) is untouched
      // so neither the comment list query nor pagination needs to
      // re-run. If no author filter is active there's nothing to
      // rename, so we no-op.
      if (!state.filterAuthor) return state
      return { ...state, filterAuthor: { ...state.filterAuthor, label: action.label } }
    case 'setPageSize':
      return { ...state, pageSize: action.value, currentPage: 0 }
    case 'setCurrentPage':
      return { ...state, currentPage: action.value }
  }
}

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
      className="tw:h-7 tw:gap-1 tw:px-2 tw:py-0 tw:text-xs"
    >
      <XIcon className="tw:size-3" />
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

  const [state, dispatch] = useReducer(reducer, {
    comments: [],
    total: 0,
    hasMore: false,
    currentPage: 0,
    pageSize: 10,
    filterStatus: initialStatus,
    // URL-restore path: we have the value but not the label, so use
    // the value as a temporary stand-in. A mount-time effect below
    // (`SEARCH_AUTHORS?ids=…`) reaches out to the server once to swap
    // the placeholder ("2232") for the real user name ("雨帆") via
    // `dispatch({ type: 'renameFilterAuthor' })`. The page-key flavour
    // intentionally stays as-is — page keys are already human-readable
    // slugs ("hello-world") and the lookup table is much smaller, so
    // the placeholder isn't noticeably ugly there.
    filterPage: initialPageKey ? { value: initialPageKey, label: initialPageKey } : null,
    filterAuthor: initialAuthorId ? { value: initialAuthorId, label: initialAuthorId } : null,
  })

  const loadFetcher = useFetcher<ApiEnvelope<LoadAllOutput>>()
  const pagesFetcher = useFetcher<ApiEnvelope<SearchPagesOutput>>()
  const authorsFetcher = useFetcher<ApiEnvelope<SearchAuthorsOutput>>()
  // Dedicated fetcher for the one-shot "ids → label" rehydrate after
  // restoring `?userId=2232` from the URL. Kept separate from
  // `authorsFetcher` (which serves the dropdown's debounced search)
  // because they race: the rehydrate fires on mount and would
  // immediately be overwritten by the empty-query autocomplete that
  // also runs on mount, causing the rename effect to never observe
  // the matching response.
  const authorRehydrateFetcher = useFetcher<ApiEnvelope<SearchAuthorsOutput>>()

  const [editTarget, setEditTarget] = useState<AdminComment | null>(null)
  const [replyTarget, setReplyTarget] = useState<AdminComment | null>(null)
  const [editUserTarget, setEditUserTarget] = useState<AdminComment | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    description: string
    actionLabel: string
    destructive: boolean
    onConfirm: () => void
  } | null>(null)
  const [replyCsrfToken, setReplyCsrfToken] = useState(commentCsrfToken)

  useEffect(() => {
    setReplyCsrfToken(commentCsrfToken)
  }, [commentCsrfToken])

  // React Router's `useFetcher()` hands back a fresh wrapper object on every
  // render, so closing over fetchers directly in `useCallback`/`useEffect`
  // deps would re-fire every render and trigger "Maximum update depth
  // exceeded". Stash the latest fetcher in a ref and depend only on the
  // user-controlled filter state.
  const loadFetcherRef = useRef(loadFetcher)
  loadFetcherRef.current = loadFetcher
  const pagesFetcherRef = useRef(pagesFetcher)
  pagesFetcherRef.current = pagesFetcher
  const authorsFetcherRef = useRef(authorsFetcher)
  authorsFetcherRef.current = authorsFetcher
  const authorRehydrateFetcherRef = useRef(authorRehydrateFetcher)
  authorRehydrateFetcherRef.current = authorRehydrateFetcher

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
    if (!initialAuthorId) return
    const params = new URLSearchParams({ ids: initialAuthorId })
    void authorRehydrateFetcherRef.current.load(`${SEARCH_AUTHORS.path}?${params.toString()}`)
  }, [initialAuthorId])

  const lastAuthorRehydrateHandled = useRef<unknown>(null)
  useEffect(() => {
    if (authorRehydrateFetcher.state !== 'idle' || !authorRehydrateFetcher.data) return
    if (authorRehydrateFetcher.data === lastAuthorRehydrateHandled.current) return
    lastAuthorRehydrateHandled.current = authorRehydrateFetcher.data
    const fetched = authorRehydrateFetcher.data.data?.authors ?? []
    if (fetched.length === 0) return
    // The endpoint returns up to N matches but for `ids=<single>` we
    // only ever care about the first row (and `searchAuthors` honours
    // `inArray(user.id, ids)`, so any returned row is by definition a
    // valid match for one of our ids).
    dispatch({ type: 'renameFilterAuthor', label: fetched[0].name })
  }, [authorRehydrateFetcher.state, authorRehydrateFetcher.data])

  const filterPageKey = state.filterPage?.value ?? ''
  const filterAuthorId = state.filterAuthor?.value ?? ''

  const reload = useCallback(() => {
    const offset = state.currentPage * state.pageSize
    void loadFetcherRef.current.submit(
      {
        offset,
        limit: state.pageSize,
        ...(filterPageKey ? { pageKey: filterPageKey } : {}),
        ...(filterAuthorId ? { userId: filterAuthorId } : {}),
        ...(state.filterStatus !== 'all' ? { status: state.filterStatus } : {}),
      },
      { method: LOAD_ALL.method, encType: 'application/json', action: LOAD_ALL.path },
    )
  }, [state.currentPage, state.pageSize, filterPageKey, filterAuthorId, state.filterStatus])

  useEffect(() => {
    reload()
  }, [reload])

  const lastLoadHandled = useRef<unknown>(null)
  useEffect(() => {
    if (loadFetcher.state !== 'idle' || !loadFetcher.data) return
    if (loadFetcher.data === lastLoadHandled.current) return
    lastLoadHandled.current = loadFetcher.data
    if (loadFetcher.data.error) {
      console.error('[admin] load failed', loadFetcher.data.error)
      return
    }
    const payload = loadFetcher.data.data
    if (!payload) return
    dispatch({ type: 'loaded', comments: payload.comments, total: payload.total, hasMore: payload.hasMore })
  }, [loadFetcher.state, loadFetcher.data])

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
  const [pageQuery, setPageQuery] = useState('')
  const [authorQuery, setAuthorQuery] = useState('')

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams()
      if (pageQuery) params.set('q', pageQuery)
      const path = params.toString() ? `${SEARCH_PAGES.path}?${params.toString()}` : SEARCH_PAGES.path
      void pagesFetcherRef.current.load(path)
    }, FILTER_QUERY_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [pageQuery])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams()
      if (authorQuery) params.set('q', authorQuery)
      const path = params.toString() ? `${SEARCH_AUTHORS.path}?${params.toString()}` : SEARCH_AUTHORS.path
      void authorsFetcherRef.current.load(path)
    }, FILTER_QUERY_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [authorQuery])

  // Server-returned items, normalised to `{ value, label }` so Base UI
  // Combobox can auto-display labels via `Combobox.Value`. We also splice
  // the currently selected item back in (when not present in the latest
  // server response) so Base UI's "selected indicator" can still find a
  // match in the rendered list — otherwise the check-mark would silently
  // disappear when the user starts typing a query that excludes their
  // current selection.
  const pageItems = useMemo<FilterItem[]>(() => {
    const fetched = pagesFetcher.data?.data?.pages ?? []
    const items = fetched.map((p) => ({ value: p.key, label: p.title || '无标题' }))
    if (state.filterPage && !items.some((i) => i.value === state.filterPage!.value)) {
      items.unshift(state.filterPage)
    }
    return items
  }, [pagesFetcher.data, state.filterPage])

  const authorItems = useMemo<FilterItem[]>(() => {
    const fetched = authorsFetcher.data?.data?.authors ?? []
    const items = fetched.map((a) => ({ value: a.id, label: a.name }))
    if (state.filterAuthor && !items.some((i) => i.value === state.filterAuthor!.value)) {
      items.unshift(state.filterAuthor)
    }
    return items
  }, [authorsFetcher.data, state.filterAuthor])

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

  const isLoading = loadFetcher.state !== 'idle'

  return (
    <>
      <div className="tw:flex tw:flex-col tw:gap-6">
        <header className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
          <div>
            <h1 className="tw:text-2xl tw:font-semibold tw:tracking-tight">评论管理</h1>
            <p className="tw:text-muted-foreground tw:text-sm">审核、回复、编辑站点评论。</p>
          </div>
          <div className="tw:flex tw:gap-2">
            <Button type="button" variant="outline" onClick={reload} disabled={isLoading}>
              <RefreshCwIcon /> 刷新
            </Button>
          </div>
        </header>

        <Card>
          <CardContent className="tw:flex tw:flex-col tw:gap-4">
            <Tabs
              value={state.filterStatus}
              onValueChange={(value) => dispatch({ type: 'setFilterStatus', value: value as FilterStatus })}
            >
              <TabsList>
                <TabsTrigger value="all">全部 · {state.total}</TabsTrigger>
                <TabsTrigger value="pending">待审核</TabsTrigger>
                <TabsTrigger value="approved">已审核</TabsTrigger>
              </TabsList>
            </Tabs>
            {/*
             * Filter row. Each column is a `flex-col` of "label row" + control.
             * The label row is fixed at `h-7` (28px = `ClearFilterButton`'s
             * height) regardless of whether a clear button is present, so the
             * three controls below stay perfectly aligned even when only the
             * middle column has an active filter (otherwise the cleared
             * column's label would collapse to ~16px and push only that
             * column's input downward).
             */}
            <div className="tw:grid tw:gap-3 tw:sm:grid-cols-3">
              <div className="tw:flex tw:flex-col tw:gap-1.5">
                <div className="tw:flex tw:h-7 tw:items-center tw:justify-between tw:gap-2">
                  <span className="tw:text-muted-foreground tw:text-xs">筛选文章</span>
                  {state.filterPage && (
                    <ClearFilterButton onClick={() => dispatch({ type: 'setFilterPage', value: null })} />
                  )}
                </div>
                <Combobox<FilterItem>
                  items={pageItems}
                  value={state.filterPage}
                  onValueChange={(item) => dispatch({ type: 'setFilterPage', value: item })}
                  inputValue={pageQuery}
                  onInputValueChange={(value) => setPageQuery(value)}
                  filter={null}
                >
                  <ComboboxTrigger className="tw:w-full">
                    <ComboboxValue placeholder="全部文章" />
                  </ComboboxTrigger>
                  <ComboboxContent<FilterItem>
                    inputPlaceholder="搜索文章…"
                    emptyMessage={pagesFetcher.state !== 'idle' ? '加载中…' : '无匹配文章'}
                  >
                    {(item) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxContent>
                </Combobox>
              </div>
              <div className="tw:flex tw:flex-col tw:gap-1.5">
                <div className="tw:flex tw:h-7 tw:items-center tw:justify-between tw:gap-2">
                  <span className="tw:text-muted-foreground tw:text-xs">筛选评论人员</span>
                  {state.filterAuthor && (
                    <ClearFilterButton onClick={() => dispatch({ type: 'setFilterAuthor', value: null })} />
                  )}
                </div>
                <Combobox<FilterItem>
                  items={authorItems}
                  value={state.filterAuthor}
                  onValueChange={(item) => dispatch({ type: 'setFilterAuthor', value: item })}
                  inputValue={authorQuery}
                  onInputValueChange={(value) => setAuthorQuery(value)}
                  filter={null}
                >
                  <ComboboxTrigger className="tw:w-full">
                    <ComboboxValue placeholder="全部人员" />
                  </ComboboxTrigger>
                  <ComboboxContent<FilterItem>
                    inputPlaceholder="搜索人员…"
                    emptyMessage={authorsFetcher.state !== 'idle' ? '加载中…' : '无匹配人员'}
                  >
                    {(item) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxContent>
                </Combobox>
              </div>
              <div className="tw:flex tw:flex-col tw:gap-1.5">
                <div className="tw:flex tw:h-7 tw:items-center">
                  <span className="tw:text-muted-foreground tw:text-xs">每页显示</span>
                </div>
                <Select
                  items={PAGE_SIZE_OPTIONS}
                  value={String(state.pageSize)}
                  onValueChange={(value) =>
                    dispatch({ type: 'setPageSize', value: Number.parseInt(value ?? '10', 10) })
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
          </CardContent>
        </Card>

        <div className="tw:flex tw:flex-col tw:gap-3">
          {isLoading ? (
            <CommentsSkeleton />
          ) : state.comments.length === 0 ? (
            <Card>
              <CardContent className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-12">
                <SearchIcon className="tw:text-muted-foreground tw:size-6" />
                <p className="tw:text-muted-foreground tw:text-sm">暂无评论</p>
              </CardContent>
            </Card>
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

        {totalPages > 1 && (
          <PaginationBar
            totalPages={totalPages}
            currentPage={state.currentPage}
            onChange={(page) => dispatch({ type: 'setCurrentPage', value: page })}
          />
        )}
      </div>

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

function CommentsSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="tw:flex tw:gap-4">
            <Skeleton className="tw:size-12 tw:shrink-0 tw:rounded-full" />
            <div className="tw:flex-1 tw:space-y-2">
              <Skeleton className="tw:h-4 tw:w-1/3" />
              <Skeleton className="tw:h-3 tw:w-1/2" />
              <Skeleton className="tw:h-12 tw:w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  )
}

interface PaginationBarProps {
  totalPages: number
  currentPage: number
  onChange: (page: number) => void
}

function PaginationBar({ totalPages, currentPage, onChange }: PaginationBarProps) {
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
