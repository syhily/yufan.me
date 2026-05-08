import { ArrowLeftIcon, ExternalLinkIcon, EyeIcon, FileTextIcon, SaveIcon, UploadIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import type {
  AdminPageDetailDto,
  AdminPageDto,
  AdminRevisionDto,
  SavePageBodyInput,
  SavePageBodyOutput,
  UpsertPageMetaInput,
  UpsertPageMetaOutput,
} from '@/shared/cms-pages'
import type { PortableTextBody } from '@/shared/portable-text'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'
import { MetaSidebar, type PageMetaDraft, EMPTY_META_DRAFT, metaDraftFromPage } from '@/ui/admin/pages/MetaSidebar'
import { PageBodyEditor } from '@/ui/admin/pages/PageBodyEditor'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { cn } from '@/ui/lib/cn'

const UPSERT_META = API_ACTIONS.admin.upsertPageMeta
const SAVE_DRAFT = API_ACTIONS.admin.saveDraft
const PUBLISH = API_ACTIONS.admin.publishLatest

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'error'; message: string }
  | { kind: 'conflict'; expectedToken: string }

export interface PageEditorShellProps {
  /**
   * Discriminator: `'create'` opens the editor in "new page" mode
   * (POSTs metadata first, then redirects to the edit URL). `'edit'`
   * loads the existing detail DTO and supports save/publish on the
   * body.
   */
  mode: 'create' | 'edit'
  /** Pre-loaded detail DTO. Only consulted when `mode === 'edit'`. */
  detail?: AdminPageDetailDto
}

// Top-level orchestrator for the page authoring screen. Owns the
// metadata draft, the body draft, and the save/publish/preview
// dispatch. Children stay focused: `MetaSidebar` is pure-props,
// `PageBodyEditor` receives a `bodyKey` so a remote-revision adoption
// flushes its content.
//
// Autosave / Local-Storage / diff-view / live preview all dock onto
// this shell as separate effects + components. This commit ships the
// metadata + manual save/publish skeleton; the autosave + LS + diff
// hooks plug in next.
export function PageEditorShell({ mode, detail }: PageEditorShellProps) {
  const navigate = useNavigate()
  const isEditing = mode === 'edit' && detail !== undefined

  // Metadata draft mirrors the right-pane form. Initial state matches
  // the loaded DTO (edit) or the empty default (create).
  const [meta, setMeta] = useState<PageMetaDraft>(isEditing ? metaDraftFromPage(detail.page) : EMPTY_META_DRAFT)

  // Body draft mirrors the editor pane. Falls back to the latest
  // revision (draft preferred over published) when opening an
  // existing page; an empty array on create.
  const initialBody = useMemo<PortableTextBody>(() => {
    if (!isEditing) {
      return []
    }
    return (detail.latestRevision ?? detail.publishedRevision)?.body ?? []
  }, [isEditing, detail])
  const [body, setBody] = useState<PortableTextBody>(initialBody)

  // The `bodyKey` controls when `<PageBodyEditor>` resets its
  // internal content. We seed it from the loaded revision so two
  // edits in the same browser tab don't blow away in-flight changes.
  const initialBodyKey = useMemo(() => {
    if (!isEditing) {
      return 'create'
    }
    const rev = detail.latestRevision ?? detail.publishedRevision
    return rev !== null ? `${detail.page.id}:${rev.clientRevisionToken}` : `${detail.page.id}:empty`
  }, [isEditing, detail])
  const [bodyKey, setBodyKey] = useState(initialBodyKey)

  // The token the next save/publish must echo. Starts at the latest
  // revision's token; every successful save updates it.
  const [expectedToken, setExpectedToken] = useState<string | null>(
    isEditing ? ((detail.latestRevision ?? detail.publishedRevision)?.clientRevisionToken ?? null) : null,
  )
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const upsertMetaApi = useApiFetcher<UpsertPageMetaInput, UpsertPageMetaOutput>(UPSERT_META, {
    onSuccess: (payload) => onMetaSaved(payload.page),
    onError: (error) => setStatus({ kind: 'error', message: error.message }),
  })
  const saveDraftApi = useApiFetcher<SavePageBodyInput, SavePageBodyOutput>(SAVE_DRAFT, {
    onSuccess: (payload) => onBodySaved(payload),
    onError: (error) => setStatus({ kind: 'error', message: error.message }),
  })
  const publishApi = useApiFetcher<SavePageBodyInput, SavePageBodyOutput>(PUBLISH, {
    onSuccess: (payload) => onBodySaved(payload),
    onError: (error) => setStatus({ kind: 'error', message: error.message }),
  })

  function onMetaSaved(saved: AdminPageDto) {
    setStatus({ kind: 'saved', at: new Date() })
    if (mode === 'create') {
      // After the first metadata save, jump to the edit URL so the
      // user can continue authoring the body. Replace the history
      // entry so "back" goes to the list rather than to /new.
      void navigate(`/wp-admin/pages/${saved.id}/edit`, { replace: true })
    } else {
      setMeta(metaDraftFromPage(saved))
    }
  }

  function onBodySaved(payload: SavePageBodyOutput) {
    if (payload.status === 'conflict') {
      setStatus({ kind: 'conflict', expectedToken: payload.expectedToken })
      // The diff resolver UI is a follow-up. For now we stop the
      // flow and surface the conflict so the user knows there's a
      // newer revision they need to rebase against.
      return
    }
    setStatus({ kind: 'saved', at: new Date() })
    setExpectedToken(payload.revision.clientRevisionToken)
    setBodyKey(`${detail?.page.id ?? 'new'}:${payload.revision.clientRevisionToken}`)
  }

  // --- Save handlers ------------------------------------------------------

  const persistMeta = useCallback(() => {
    setStatus({ kind: 'saving' })
    upsertMetaApi.submit({
      id: isEditing ? detail.page.id : undefined,
      slug: meta.slug.trim(),
      title: meta.title.trim(),
      summary: meta.summary.trim(),
      cover: meta.cover.trim(),
      og: meta.og.trim() === '' ? null : meta.og.trim(),
      published: meta.published,
      commentsEnabled: meta.commentsEnabled,
      showToc: meta.showToc,
    })
  }, [upsertMetaApi, isEditing, detail, meta])

  const persistDraft = useCallback(() => {
    if (!isEditing) {
      setStatus({ kind: 'error', message: '请先保存页面信息再编辑正文。' })
      return
    }
    setStatus({ kind: 'saving' })
    saveDraftApi.submit({
      id: detail.page.id,
      body,
      expectedClientRevisionToken: expectedToken,
    })
  }, [saveDraftApi, isEditing, detail, body, expectedToken])

  const persistPublish = useCallback(() => {
    if (!isEditing) {
      setStatus({ kind: 'error', message: '请先保存页面信息再发布。' })
      return
    }
    setStatus({ kind: 'saving' })
    publishApi.submit({
      id: detail.page.id,
      body,
      expectedClientRevisionToken: expectedToken,
    })
  }, [publishApi, isEditing, detail, body, expectedToken])

  // Cmd/Ctrl-S triggers the appropriate save: meta on create, draft
  // on edit. Publish stays a deliberate click — too easy to misfire.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (mode === 'create') {
          persistMeta()
        } else {
          persistDraft()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, persistMeta, persistDraft])

  const isMetaPending = upsertMetaApi.isPending
  const isBodyPending = saveDraftApi.isPending || publishApi.isPending
  const isPending = isMetaPending || isBodyPending

  const canPersistMeta = meta.slug.trim() !== '' && meta.title.trim() !== ''

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link to="/wp-admin/pages">
              <ArrowLeftIcon /> 返回列表
            </Link>
          }
        />
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-4 text-muted-foreground" />
          <h1 className="text-base font-semibold">{mode === 'create' ? '新建页面' : meta.title || '未命名页面'}</h1>
          {isEditing ? <RevisionStatusBadge revision={detail.latestRevision} /> : null}
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <StatusIndicator status={status} />
          {isEditing ? (
            <Button
              variant="ghost"
              size="sm"
              render={
                <Link to={`/${detail.page.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon /> 公开预览
                </Link>
              }
            />
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={persistMeta}
            disabled={isPending || !canPersistMeta}
            title="保存页面信息"
          >
            <SaveIcon /> {mode === 'create' ? '创建页面' : '保存信息'}
          </Button>
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={persistDraft} disabled={isPending}>
                <SaveIcon /> 保存草稿
              </Button>
              <Button size="sm" onClick={persistPublish} disabled={isPending}>
                <UploadIcon /> 发布
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <div
        className={cn(
          'grid min-h-0 grow gap-4',
          // Two columns on lg+ — left flex-grow editor, fixed-width
          // right pane for metadata. On smaller screens the metadata
          // panel drops below the editor.
          'lg:grid-cols-[minmax(0,1fr)_360px]',
        )}
      >
        <div className="flex min-h-0 flex-col">
          {mode === 'create' ? (
            <CreateModeHint />
          ) : (
            <PageBodyEditor initialBody={initialBody} bodyKey={bodyKey} onBodyChange={setBody} disabled={isPending} />
          )}
        </div>
        <aside className="min-h-0 overflow-y-auto pr-1">
          <MetaSidebar draft={meta} onChange={setMeta} disabled={isPending} />
        </aside>
      </div>
    </div>
  )
}

function CreateModeHint() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-card/50 p-12 text-center">
      <FileTextIcon className="size-10 text-muted-foreground" />
      <div className="text-sm text-muted-foreground">填写右侧页面信息后点击「创建页面」，就可以开始编辑正文了。</div>
    </div>
  )
}

function StatusIndicator({ status }: { status: Status }) {
  switch (status.kind) {
    case 'idle':
      return null
    case 'saving':
      return <span className="text-muted-foreground">保存中…</span>
    case 'saved':
      return <span className="text-muted-foreground">已保存 {status.at.toLocaleTimeString('zh-CN')}</span>
    case 'error':
      return <span className="text-destructive">{status.message}</span>
    case 'conflict':
      return <span className="text-destructive">检测到云端有更新的修订，请刷新后再保存。</span>
  }
}

function RevisionStatusBadge({ revision }: { revision: AdminRevisionDto | null }) {
  if (revision === null) {
    return <Badge variant="outline">无修订</Badge>
  }
  if (revision.status === 'published') {
    return <Badge>已发布 R{revision.revisionNo}</Badge>
  }
  return (
    <Badge variant="secondary">
      <EyeIcon /> 草稿 R{revision.revisionNo}
    </Badge>
  )
}
