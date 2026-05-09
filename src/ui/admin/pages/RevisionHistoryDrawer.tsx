import { ArrowLeftIcon, CheckIcon, HistoryIcon, RefreshCcwIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { AdminRevisionDto, ListPageRevisionsInput, ListPageRevisionsOutput } from '@/shared/cms-pages'
import type { PortableTextBody } from '@/shared/portable-text'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { diffBodies, DiffPanel } from '@/ui/admin/pages/portable-text-diff'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/components/ui/sheet'
import { cn } from '@/ui/lib/cn'

const LIST_REVISIONS = API_ACTIONS.admin.listPageRevisions

// Revision history drawer. Two stages:
//
//   1. List view — all revisions, newest-first, with status,
//      timestamps, and a structural summary (heading / image
//      counts). Clicking a row drops into the detail view for
//      that revision.
//
//   2. Detail view — single-column diff between the selected
//      historical revision (left/red) and the editor's current
//      body (right/green). Below the diff: a "选择此版本"
//      button that adopts the historical body into the editor.
//      Adopting does NOT write to the server — it loads the body
//      into the editor pane so the operator can save a new draft
//      revision (or publish) on top of it.
//
// The drawer is intentionally wide enough for the diff
// (`w-[640px]`) but renders the list on smaller widths fine.

export interface RevisionHistoryDrawerProps {
  pageId: string
  /** Token of the currently displayed revision; used to highlight the row. */
  currentToken: string | null
  /** PortableText body currently displayed in the editor. */
  currentBody: PortableTextBody
  /**
   * Adopt the historical revision's body into the editor pane.
   * Implementation owned by the editor shell — typically `setBody`
   * + `setBodyKey` to force a remount, leaving the autosave layer
   * to push the adopted body through `saveDraft`.
   */
  onAdoptRevision: (revision: AdminRevisionDto) => void
}

export function RevisionHistoryDrawer({
  pageId,
  currentToken,
  currentBody,
  onAdoptRevision,
}: RevisionHistoryDrawerProps) {
  const [open, setOpen] = useState(false)
  const [revisions, setRevisions] = useState<AdminRevisionDto[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { load, isPending } = useApiFetcher<ListPageRevisionsInput, ListPageRevisionsOutput>(LIST_REVISIONS, {
    onSuccess: (payload) => setRevisions(payload.revisions),
  })

  // Fetch on first open. Re-opening reuses the cache; the operator
  // refetches through the explicit refresh button. The endpoint is
  // GET-only — `load(query)` URL-encodes `id` into the search params,
  // which is the channel the loader (`readSearchInput`) expects.
  // Calling `submit({ id })` would route through React Router's JSON
  // body channel which is invalid for GET and surfaces as a 400/500.
  useEffect(() => {
    if (open && revisions === null) {
      load({ id: pageId })
    }
  }, [open, revisions, load, pageId])

  // Clear the selected detail view whenever the drawer closes so
  // the next open starts on the list.
  useEffect(() => {
    if (!open) {
      setSelectedId(null)
    }
  }, [open])

  const selectedRevision = useMemo<AdminRevisionDto | null>(
    () => revisions?.find((r) => r.id === selectedId) ?? null,
    [revisions, selectedId],
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="sm" className="w-full justify-start" type="button">
            <HistoryIcon /> 历史版本
          </Button>
        }
      />
      <SheetContent side="right" className="w-160 sm:max-w-160">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {selectedRevision !== null ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedId(null)}
                  title="返回列表"
                  aria-label="返回列表"
                >
                  <ArrowLeftIcon />
                </Button>
                <span>R{selectedRevision.revisionNo} · 与当前正文对比</span>
              </>
            ) : (
              <>
                <HistoryIcon className="size-4" />
                <span>历史版本</span>
              </>
            )}
          </SheetTitle>
        </SheetHeader>
        {selectedRevision === null ? (
          <RevisionListView
            revisions={revisions}
            currentToken={currentToken}
            isFetching={isPending}
            onSelect={setSelectedId}
            onRefresh={() => {
              setRevisions(null)
              load({ id: pageId })
            }}
          />
        ) : (
          <RevisionDetailView
            revision={selectedRevision}
            currentBody={currentBody}
            isCurrent={selectedRevision.clientRevisionToken === currentToken}
            onAdopt={() => {
              onAdoptRevision(selectedRevision)
              setOpen(false)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

// --- List view -------------------------------------------------------------

interface RevisionListViewProps {
  revisions: AdminRevisionDto[] | null
  currentToken: string | null
  isFetching: boolean
  onSelect: (id: string) => void
  onRefresh: () => void
}

function RevisionListView({ revisions, currentToken, isFetching, onSelect, onRefresh }: RevisionListViewProps) {
  return (
    <>
      <div className="flex items-center justify-between p-4 pt-0">
        <span className="text-xs text-muted-foreground">
          {revisions !== null ? `${revisions.length} 个修订` : '加载中…'}
        </span>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isFetching}>
          <RefreshCcwIcon /> 刷新
        </Button>
      </div>
      <ol className="flex flex-col gap-2 px-4 pb-4">
        {revisions?.map((revision) => (
          <RevisionRow
            key={revision.id}
            revision={revision}
            isCurrent={revision.clientRevisionToken === currentToken}
            onClick={() => onSelect(revision.id)}
          />
        ))}
        {revisions !== null && revisions.length === 0 ? (
          <li className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">暂无历史</li>
        ) : null}
      </ol>
    </>
  )
}

interface RevisionRowProps {
  revision: AdminRevisionDto
  isCurrent: boolean
  onClick: () => void
}

function RevisionRow({ revision, isCurrent, onClick }: RevisionRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full rounded border bg-card p-3 text-left text-sm transition',
          'hover:border-primary/60 hover:bg-accent',
          isCurrent ? 'border-primary' : 'border-border',
        )}
        aria-current={isCurrent ? 'true' : undefined}
      >
        <div className="flex items-center gap-2">
          <Badge variant={revision.status === 'published' ? 'default' : 'secondary'}>
            R{revision.revisionNo} · {revision.status === 'published' ? '已发布' : '草稿'}
          </Badge>
          {isCurrent ? <Badge variant="outline">当前</Badge> : null}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          创建于 {new Date(revision.createdAt).toLocaleString('zh-CN')}
        </div>
        <div className="text-xs text-muted-foreground">
          更新于 {new Date(revision.updatedAt).toLocaleString('zh-CN')}
        </div>
        {revision.headings.length > 0 || revision.imageSources.length > 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">
            {revision.headings.length} 个标题 · {revision.imageSources.length} 张图片
          </div>
        ) : null}
      </button>
    </li>
  )
}

// --- Detail (diff) view ----------------------------------------------------

interface RevisionDetailViewProps {
  revision: AdminRevisionDto
  currentBody: PortableTextBody
  isCurrent: boolean
  onAdopt: () => void
}

function RevisionDetailView({ revision, currentBody, isCurrent, onAdopt }: RevisionDetailViewProps) {
  // Historical on the *left* (red / removed if it differs from
  // current), editor's current on the *right* (green / added).
  // We render only the right side: a single column diff is enough
  // for the operator's "should I adopt this?" question. The
  // historical view is implicit (deletions show through line-
  // through styling on changed text blocks).
  const diff = useMemo(() => diffBodies(revision.body, currentBody), [revision.body, currentBody])
  const changedCount = diff.filter((entry) => entry.status !== 'unchanged').length

  return (
    <div className="flex min-h-0 grow flex-col gap-3 overflow-hidden px-4 pb-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={revision.status === 'published' ? 'default' : 'secondary'}>
          R{revision.revisionNo} · {revision.status === 'published' ? '已发布' : '草稿'}
        </Badge>
        <span>更新于 {new Date(revision.updatedAt).toLocaleString('zh-CN')}</span>
        <span className="ml-auto">{changedCount === 0 ? '与当前一致' : `${changedCount} 处差异`}</span>
      </div>
      <div className="grid min-h-0 grow grid-cols-2 gap-2 overflow-hidden rounded-md border bg-card">
        <div className="flex min-h-0 flex-col border-r">
          <div className="border-b bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">历史版本</div>
          <div className="min-h-0 grow overflow-y-auto p-2">
            <DiffPanel diff={diff} side="left" />
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="border-b bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">当前正文</div>
          <div className="min-h-0 grow overflow-y-auto p-2">
            <DiffPanel diff={diff} side="right" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-md border bg-card p-3 text-xs text-muted-foreground">
        <span>选择此版本会用历史正文替换编辑器内容；更改不会立刻保存到服务器，需要再点一次「保存」或「发布」。</span>
        <Button onClick={onAdopt} disabled={isCurrent} title={isCurrent ? '当前正在编辑此版本' : '使用此版本'}>
          <CheckIcon /> {isCurrent ? '当前' : '选择此版本'}
        </Button>
      </div>
    </div>
  )
}
