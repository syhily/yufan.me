import { HistoryIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { AdminRevisionDto, ListPageRevisionsInput, ListPageRevisionsOutput } from '@/shared/cms-pages'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/components/ui/sheet'
import { cn } from '@/ui/lib/cn'

const LIST_REVISIONS = API_ACTIONS.admin.listPageRevisions

// Read-only revision history drawer. Triggered from the metadata
// sidebar — opens a right-side sheet listing every saved revision
// (newest first) with status badge, author, and timestamps. The
// drawer is intentionally lazy: revisions are only fetched on first
// open, so the list view doesn't pay the round-trip cost just to
// render a button. Body restoration is **not** wired here — it
// would have to round-trip through the autosave + conflict UX, which
// is a follow-up.

export interface RevisionHistoryDrawerProps {
  pageId: string
  /** Token of the currently displayed revision; used to highlight the row. */
  currentToken: string | null
}

export function RevisionHistoryDrawer({ pageId, currentToken }: RevisionHistoryDrawerProps) {
  const [open, setOpen] = useState(false)
  const [revisions, setRevisions] = useState<AdminRevisionDto[] | null>(null)

  const fetcher = useApiFetcher<ListPageRevisionsInput, ListPageRevisionsOutput>(LIST_REVISIONS, {
    onSuccess: (payload) => setRevisions(payload.revisions),
  })

  // Fetch on first open; subsequent opens reuse the cache. The user
  // can refetch through the explicit refresh button.
  useEffect(() => {
    if (open && revisions === null) {
      fetcher.submit({ id: pageId })
    }
  }, [open, revisions, fetcher, pageId])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="sm" className="w-full justify-start" type="button">
            <HistoryIcon /> 历史版本
          </Button>
        }
      />
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>历史版本</SheetTitle>
        </SheetHeader>
        <div className="flex items-center justify-between p-4 pt-0">
          <span className="text-xs text-muted-foreground">
            {revisions !== null ? `${revisions.length} 个修订` : '加载中…'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRevisions(null)
              fetcher.submit({ id: pageId })
            }}
            disabled={fetcher.isPending}
          >
            刷新
          </Button>
        </div>
        <ol className="flex flex-col gap-2 px-4 pb-4">
          {revisions?.map((revision) => (
            <RevisionRow
              key={revision.id}
              revision={revision}
              isCurrent={revision.clientRevisionToken === currentToken}
            />
          ))}
          {revisions !== null && revisions.length === 0 ? (
            <li className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">暂无历史</li>
          ) : null}
        </ol>
      </SheetContent>
    </Sheet>
  )
}

interface RevisionRowProps {
  revision: AdminRevisionDto
  isCurrent: boolean
}

function RevisionRow({ revision, isCurrent }: RevisionRowProps) {
  return (
    <li
      className={cn('rounded border bg-card p-3 text-sm', isCurrent ? 'border-primary' : 'border-border')}
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
      <div className="text-xs text-muted-foreground">更新于 {new Date(revision.updatedAt).toLocaleString('zh-CN')}</div>
      {revision.headings.length > 0 ? (
        <div className="mt-2 text-xs text-muted-foreground">
          {revision.headings.length} 个标题，{revision.imageSources.length} 张图片
        </div>
      ) : null}
    </li>
  )
}
