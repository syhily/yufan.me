import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PencilLineIcon,
  SaveIcon,
  UploadIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import type {
  AdminPageDetailDto,
  AdminPageDto,
  SavePageBodyInput,
  SavePageBodyOutput,
  UpsertPageMetaInput,
  UpsertPageMetaOutput,
} from '@/shared/cms-pages'
import type { PortableTextBody } from '@/shared/portable-text'

import { useApiFetcher } from '@/client/api/fetcher'
import { submitApiAction } from '@/client/api/submit'
import { useCreatePageDraft } from '@/client/hooks/use-create-page-draft'
import { usePageAutosave } from '@/client/hooks/use-page-autosave'
import { usePageLocalDraft } from '@/client/hooks/use-page-local-draft'
import { API_ACTIONS } from '@/shared/api-actions'
import { DraftConflictDialog } from '@/ui/admin/pages/DraftConflictDialog'
import {
  EMPTY_META_DRAFT,
  localInputValueToIso,
  metaDraftFromPage,
  MetaSidebar,
  type PageMetaDraft,
} from '@/ui/admin/pages/MetaSidebar'
import { PageBodyEditor } from '@/ui/admin/pages/PageBodyEditor'
import { PreviewPane } from '@/ui/admin/pages/PreviewPane'
import { RevisionHistoryDrawer } from '@/ui/admin/pages/RevisionHistoryDrawer'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/ui/tabs'
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
      return 'create:initial'
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

  // --- Local Storage draft persistence --------------------------------------
  // Edit mode keys on `(pageId, clientRevisionToken)` so adopting a
  // remote revision (or saving) starts a fresh slot.
  const { loadedDraft, clearDraft } = usePageLocalDraft({
    pageId: isEditing ? detail.page.id : null,
    clientRevisionToken: expectedToken,
    body,
    disabled: !isEditing,
  })

  // Create mode mirrors body + meta into a per-tab LS slot so closing
  // the tab mid-authoring doesn't lose work and a refresh restores
  // exactly where the user left off. Once the user clicks "create
  // page" we migrate the slot to the canonical edit-mode key shape.
  const createDraft = useCreatePageDraft({ body, meta })
  const createDraftHydratedRef = useRef(false)
  useEffect(() => {
    if (isEditing) {
      return
    }
    if (createDraftHydratedRef.current) {
      return
    }
    if (createDraft.loadedDraft === null) {
      // No LS slot to restore — mark as hydrated so we don't keep
      // checking on every render.
      createDraftHydratedRef.current = true
      return
    }
    createDraftHydratedRef.current = true
    setMeta(createDraft.loadedDraft.meta)
    setBody(createDraft.loadedDraft.body)
    // Force `<PageBodyEditor>` to remount with the restored content.
    setBodyKey(`create:restored:${createDraft.loadedDraft.savedAt}`)
  }, [isEditing, createDraft.loadedDraft])

  // When the loader observes a local draft different from the body
  // we just hydrated from the server's latest revision, present the
  // diff resolver. Otherwise silently discard the LS slot — its
  // payload matches what the server already has.
  const [conflict, setConflict] = useState<{ localBody: PortableTextBody; localSavedAt: number } | null>(null)
  const [conflictResolved, setConflictResolved] = useState(false)
  useEffect(() => {
    if (conflictResolved) {
      return
    }
    if (loadedDraft === null) {
      return
    }
    // Compare structurally — same `JSON.stringify` semantics as the
    // diff resolver so the "they're equal" branch matches the
    // resolver's notion of equality.
    if (JSON.stringify(loadedDraft.body) === JSON.stringify(initialBody)) {
      return
    }
    setConflict({ localBody: loadedDraft.body, localSavedAt: loadedDraft.savedAt })
  }, [loadedDraft, initialBody, conflictResolved])

  // `create` mode chains upsertMeta → saveDraft → navigate, so it
  // can't piggy-back on `useApiFetcher` (which exposes a synchronous
  // `submit()` and an `onSuccess` callback). The chain runs through
  // `submitApiAction` instead and tracks its own pending flag.
  const [isCreatingPage, setIsCreatingPage] = useState(false)
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

  // --- Autosave -------------------------------------------------------------
  // Disabled while a save is in flight, while a conflict dialog is
  // pending resolution, or in `create` mode (no `id` to save against
  // yet). The flush hits `saveDraft` directly via `submitApiAction`
  // so the autosave can `await` each round-trip — `useApiFetcher`'s
  // sync `submit()` doesn't return a promise.
  const autosaveEnabled =
    isEditing && conflict === null && !isPendingForAutosave({ upsertMetaApi, saveDraftApi, publishApi })
  // The `onBodySaved` reducer reads from a closure that captures
  // `detail`, `expectedToken`, etc. We mirror it through a ref so the
  // autosave flush always picks up the latest values without forcing
  // every keystroke to recreate the flush callback.
  const handleBodySavedRef = useRef<(payload: SavePageBodyOutput) => void>(() => undefined)
  handleBodySavedRef.current = (payload) => onBodySaved(payload)

  const flushAutosave = useCallback(
    async (snapshot: PortableTextBody) => {
      if (!isEditing) {
        return
      }
      const envelope = await submitApiAction<SavePageBodyInput, SavePageBodyOutput>(SAVE_DRAFT, {
        id: detail.page.id,
        body: snapshot,
        expectedClientRevisionToken: expectedToken,
      })
      if ('data' in envelope && envelope.data !== undefined) {
        handleBodySavedRef.current(envelope.data)
        return
      }
      if ('error' in envelope && envelope.error !== undefined) {
        setStatus({ kind: 'error', message: envelope.error.message })
      }
    },
    [isEditing, detail, expectedToken],
  )

  usePageAutosave({
    body,
    enabled: autosaveEnabled,
    flush: flushAutosave,
  })

  function onMetaSaved(saved: AdminPageDto) {
    // `useApiFetcher.onSuccess` is the edit-mode path. Create mode
    // routes through `persistCreate()` instead — the `submit()` call
    // there bypasses this callback by using `submitApiAction`.
    setStatus({ kind: 'saved', at: new Date() })
    setMeta(metaDraftFromPage(saved))
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
    if (!isEditing) {
      // Edit mode reaches this through `persistCreate` instead.
      return
    }
    setStatus({ kind: 'saving' })
    const publishedAt = localInputValueToIso(meta.publishedAt)
    upsertMetaApi.submit({
      id: detail.page.id,
      slug: meta.slug.trim(),
      title: meta.title.trim(),
      summary: meta.summary.trim(),
      cover: meta.cover.trim(),
      og: meta.og.trim() === '' ? null : meta.og.trim(),
      published: meta.published,
      commentsEnabled: meta.commentsEnabled,
      showToc: meta.showToc,
      ...(publishedAt !== null ? { publishedAt } : {}),
    })
  }, [upsertMetaApi, isEditing, detail, meta])

  // Two-step "create page" flow: upsert metadata to assign an id,
  // then push the locally-authored body to the brand-new page in a
  // single click. Once both succeed we migrate the LS slot to the
  // canonical edit-mode key shape and navigate to `/edit/:id` so
  // subsequent saves go through the regular edit-mode path.
  const persistCreate = useCallback(async () => {
    if (isEditing || isCreatingPage) {
      return
    }
    setIsCreatingPage(true)
    setStatus({ kind: 'saving' })

    const publishedAt = localInputValueToIso(meta.publishedAt)
    const metaEnvelope = await submitApiAction<UpsertPageMetaInput, UpsertPageMetaOutput>(UPSERT_META, {
      slug: meta.slug.trim(),
      title: meta.title.trim(),
      summary: meta.summary.trim(),
      cover: meta.cover.trim(),
      og: meta.og.trim() === '' ? null : meta.og.trim(),
      published: meta.published,
      commentsEnabled: meta.commentsEnabled,
      showToc: meta.showToc,
      ...(publishedAt !== null ? { publishedAt } : {}),
    })
    if (!('data' in metaEnvelope) || metaEnvelope.data === undefined) {
      const errorMessage = 'error' in metaEnvelope && metaEnvelope.error ? metaEnvelope.error.message : '保存失败'
      setStatus({ kind: 'error', message: errorMessage })
      setIsCreatingPage(false)
      return
    }
    const savedPage = metaEnvelope.data.page

    // Push the body through `saveDraft`. `expectedClientRevisionToken: null`
    // because there's no revision yet — saveDraft creates the first one.
    const draftEnvelope = await submitApiAction<SavePageBodyInput, SavePageBodyOutput>(SAVE_DRAFT, {
      id: savedPage.id,
      body,
      expectedClientRevisionToken: null,
    })
    if (!('data' in draftEnvelope) || draftEnvelope.data === undefined) {
      const errorMessage =
        'error' in draftEnvelope && draftEnvelope.error ? draftEnvelope.error.message : '保存正文失败'
      setStatus({ kind: 'error', message: errorMessage })
      setIsCreatingPage(false)
      // The metadata row exists at this point so navigate the user
      // there — they can retry the body save from the edit screen.
      void navigate(`/wp-admin/pages/${savedPage.id}/edit`, { replace: true })
      return
    }
    if (draftEnvelope.data.status === 'conflict') {
      // A genuinely unreachable branch on a brand-new page — a fresh
      // row can't have a competing revision — but treat it as a
      // soft failure rather than crashing.
      setStatus({ kind: 'conflict', expectedToken: draftEnvelope.data.expectedToken })
      setIsCreatingPage(false)
      void navigate(`/wp-admin/pages/${savedPage.id}/edit`, { replace: true })
      return
    }

    // Migrate the LS slot from `cms-page-draft:new:<sessionId>` to
    // the edit-mode shape so a refresh on the edit screen still
    // loads the just-saved body without showing a conflict.
    createDraft.migrateToEditKey(savedPage.id, draftEnvelope.data.revision.clientRevisionToken, body)

    setStatus({ kind: 'saved', at: new Date() })
    setIsCreatingPage(false)
    void navigate(`/wp-admin/pages/${savedPage.id}/edit`, { replace: true })
  }, [isEditing, isCreatingPage, meta, body, createDraft, navigate])

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

  // Cmd/Ctrl-S triggers the appropriate save: create-flow on create,
  // draft on edit. Cmd/Ctrl+Shift+P publishes the latest body.
  // Both shortcuts also gate on the same enabled-conditions as the
  // toolbar buttons so a stale `published-current` page can't be
  // re-published with no edits, etc.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.metaKey && !event.ctrlKey) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === 's' && !event.shiftKey) {
        event.preventDefault()
        if (mode === 'create') {
          void persistCreate()
        } else {
          persistDraft()
        }
        return
      }
      if (key === 'p' && event.shiftKey) {
        event.preventDefault()
        if (isEditing) {
          persistPublish()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, isEditing, persistCreate, persistDraft, persistPublish])

  const isMetaPending = upsertMetaApi.isPending || isCreatingPage
  const isBodyPending = saveDraftApi.isPending || publishApi.isPending
  const isPending = isMetaPending || isBodyPending

  // --- Conflict resolution handlers -----------------------------------------
  const adoptLocalDraft = useCallback(() => {
    if (conflict === null) {
      return
    }
    setBody(conflict.localBody)
    setBodyKey(`${detail?.page.id ?? 'new'}:adopt-local:${Date.now()}`)
    setConflict(null)
    setConflictResolved(true)
  }, [conflict, detail])

  const adoptServerVersion = useCallback(() => {
    setBody(initialBody)
    setBodyKey(`${detail?.page.id ?? 'new'}:adopt-server:${Date.now()}`)
    clearDraft()
    setConflict(null)
    setConflictResolved(true)
  }, [initialBody, detail, clearDraft])

  const canPersistMeta = meta.slug.trim() !== '' && meta.title.trim() !== ''

  const publishState = useMemo<PublishState>(
    () => (isEditing ? derivePublishState(detail) : { kind: 'not-published-yet' }),
    [isEditing, detail],
  )
  // The publish button is suppressed when the latest revision *is*
  // already the published one, because publishing again would just
  // create an empty no-op revision. The user can still re-publish by
  // making any edit (which moves to `draft-ahead`).
  const canPublish = isEditing && publishState.kind !== 'published-current'

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
          {isEditing ? <RevisionStatusBadge state={publishState} /> : null}
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
          {mode === 'create' ? (
            <Button
              size="sm"
              onClick={() => {
                void persistCreate()
              }}
              disabled={isPending || !canPersistMeta}
              title="保存页面信息并上传当前正文"
            >
              <UploadIcon /> 创建页面
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={persistMeta}
                disabled={isPending || !canPersistMeta}
                title="保存页面信息"
              >
                <SaveIcon /> 保存信息
              </Button>
              <Button variant="outline" size="sm" onClick={persistDraft} disabled={isPending}>
                <SaveIcon /> 保存草稿
              </Button>
              <Button
                size="sm"
                onClick={persistPublish}
                disabled={isPending || !canPublish}
                title={canPublish ? '发布最新内容 (Cmd/Ctrl+Shift+P)' : '当前最新版本已发布'}
              >
                <UploadIcon /> 发布
              </Button>
            </>
          )}
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
        <div className="flex min-h-0 flex-col gap-2">
          {mode === 'create' ? <CreateModeBanner draftSavedAt={createDraft.loadedDraft?.savedAt ?? null} /> : null}
          <PageBodyEditor initialBody={initialBody} bodyKey={bodyKey} onBodyChange={setBody} disabled={isPending} />
        </div>
        <aside className="flex min-h-0 flex-col">
          <Tabs defaultValue="meta" className="min-h-0 grow">
            <TabsList className="self-start">
              <TabsTrigger value="meta">页面信息</TabsTrigger>
              <TabsTrigger value="preview">实时预览</TabsTrigger>
            </TabsList>
            <TabsContent value="meta" className="min-h-0 overflow-y-auto pr-1">
              <MetaSidebar
                draft={meta}
                onChange={setMeta}
                disabled={isPending}
                extras={
                  isEditing ? (
                    <div className="rounded-md border bg-card p-2">
                      <RevisionHistoryDrawer pageId={detail.page.id} currentToken={expectedToken} />
                    </div>
                  ) : null
                }
              />
            </TabsContent>
            <TabsContent value="preview" className="flex min-h-0 grow flex-col">
              <PreviewPane body={body} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      {conflict !== null && isEditing ? (
        <DraftConflictDialog
          open={true}
          localBody={conflict.localBody}
          serverBody={initialBody}
          localSavedAt={conflict.localSavedAt}
          serverUpdatedAt={
            (detail.latestRevision ?? detail.publishedRevision)?.updatedAt
              ? Date.parse((detail.latestRevision ?? detail.publishedRevision)!.updatedAt)
              : null
          }
          onChooseLocal={adoptLocalDraft}
          onChooseServer={adoptServerVersion}
        />
      ) : null}
    </div>
  )
}

interface AutosavePendingArg {
  upsertMetaApi: { isPending: boolean }
  saveDraftApi: { isPending: boolean }
  publishApi: { isPending: boolean }
}

function isPendingForAutosave({ upsertMetaApi, saveDraftApi, publishApi }: AutosavePendingArg): boolean {
  return upsertMetaApi.isPending || saveDraftApi.isPending || publishApi.isPending
}

interface CreateModeBannerProps {
  draftSavedAt: number | null
}

function CreateModeBanner({ draftSavedAt }: CreateModeBannerProps) {
  // Show a thin banner so the user understands the body is being
  // mirrored locally and won't be uploaded until they hit "create".
  // Once a previous local draft has been restored we surface the
  // timestamp so the user can verify nothing was lost.
  return (
    <div className="flex items-center justify-between rounded-md border border-dashed bg-card/50 px-3 py-2 text-xs text-muted-foreground">
      <span>新页面正文仅本地保留，点击「创建页面」后才会同步到服务器。</span>
      {draftSavedAt !== null ? (
        <span className="font-mono">已恢复本地草稿 · {new Date(draftSavedAt).toLocaleTimeString('zh-CN')}</span>
      ) : null}
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

type PublishState =
  | { kind: 'not-published-yet' }
  | { kind: 'published-current'; revisionNo: number }
  | { kind: 'draft-ahead'; draftRevisionNo: number; publishedRevisionNo: number | null }

function derivePublishState(detail: AdminPageDetailDto): PublishState {
  const latest = detail.latestRevision
  const published = detail.publishedRevision
  if (latest === null) {
    return { kind: 'not-published-yet' }
  }
  if (latest.status === 'published') {
    // The latest revision is itself the published row — no newer
    // draft ahead of it.
    return { kind: 'published-current', revisionNo: latest.revisionNo }
  }
  // Latest is a draft. There may or may not be a published revision
  // behind it.
  return {
    kind: 'draft-ahead',
    draftRevisionNo: latest.revisionNo,
    publishedRevisionNo: published?.revisionNo ?? null,
  }
}

function RevisionStatusBadge({ state }: { state: PublishState }) {
  switch (state.kind) {
    case 'not-published-yet':
      return (
        <Badge variant="outline">
          <CircleDashedIcon /> 尚未发布
        </Badge>
      )
    case 'published-current':
      return (
        <Badge>
          <CheckCircle2Icon /> 已发布 R{state.revisionNo}
        </Badge>
      )
    case 'draft-ahead':
      return (
        <Badge variant="secondary">
          <PencilLineIcon /> 草稿 R{state.draftRevisionNo}
          {state.publishedRevisionNo !== null ? (
            <span className="ml-1 opacity-70">/ R{state.publishedRevisionNo} 已发布</span>
          ) : null}
        </Badge>
      )
  }
}
