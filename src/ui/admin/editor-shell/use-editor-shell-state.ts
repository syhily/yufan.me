import type { NavigateFunction } from 'react-router'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { PortableTextBody } from '@/shared/pt/schema'

import { useMutation } from '@/client/api/query'
import { useAutosave, type AutosaveStatus } from '@/client/hooks/use-autosave'
import { useSyncScroll } from '@/client/hooks/use-sync-scroll'
import { arePortableTextBodiesEquivalent } from '@/shared/pt/bridge/canonicalize'
import { useAdminChromeFocus, useAdminScrollTopLift } from '@/ui/admin/shell/AdminShell'

// --- Status / projection types (shared by Post + Page editor shells) -------

export type EditorShellStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'error'; message: string }
  | { kind: 'conflict'; expectedToken: string }
  // Neutral message — not an error, but not a "saved" either.
  // Used by flows like "loaded a history revision" that need to
  // tell the user "you have unsaved local changes" without
  // colouring the chip red.
  | { kind: 'info'; message: string }

export type PublishState =
  // No revision has been promoted yet. Saving still works; the entity
  // is invisible to the public until a manual 发布.
  | { kind: 'not-published-yet' }
  // Latest revision was promoted AND `meta.published === true` —
  // entity is live with the current body.
  | { kind: 'published-current'; revisionNo: number }
  // Latest is a draft sitting on top of a (possibly missing)
  // published revision. Visible publicly iff `meta.published`.
  | { kind: 'draft-ahead'; draftRevisionNo: number; publishedRevisionNo: number | null }
  // A revision was promoted at some point but the operator later
  // hit 取消发布. The body still exists in `content`; flipping
  // `meta.published` back to true re-shows the entity.
  | { kind: 'unpublished'; lastPublishedRevisionNo: number | null }

export type SidebarPublishStatus = 'never-saved' | 'offline' | 'scheduled' | 'live' | 'live-with-draft-ahead'

export type SidebarRevisionSummary =
  | { kind: 'no-revision' }
  | { kind: 'published-current'; revisionNo: number }
  | { kind: 'draft-ahead'; draftRevisionNo: number; publishedRevisionNo: number | null }

export type SidebarSaveStatus =
  | { kind: 'saving' }
  | { kind: 'saved'; atMs: number }
  | { kind: 'unsaved' }
  | { kind: 'conflict' }
  | { kind: 'error'; message: string }
  | { kind: 'info'; message: string }

// --- Minimal shapes the hook reads off the per-entity DTOs -----------------

/**
 * The fields the hook reads off `AdminRevisionDto`. Both `AdminPost…` and
 * `AdminPage…` versions of the type are structurally identical (compare
 * `src/shared/types/{posts,pages}.ts`), so the hook just declares the
 * subset it needs and accepts both via structural typing.
 */
export interface RevisionLike {
  id: string
  revisionNo: number
  status: 'draft' | 'published'
  body: PortableTextBody
  clientRevisionToken: string
  updatedAt: string
}

/**
 * The fields the hook reads off the entity DTO (`AdminPostDto` /
 * `AdminPageDto`). Both share these — entity-specific fields
 * (`category`, `tags`, `pinnedAt`, `alias` on posts; `showFriends`
 * on pages) live in `TMeta` and the Shell's mutation payload builders.
 */
export interface EntityLike {
  id: string
  slug: string
  updatedAt: string
  publishedAt: string | null
}

export type SaveBodyOutput =
  | { status: 'saved'; revision: RevisionLike }
  | { status: 'conflict'; expectedToken: string; latest: RevisionLike }

// --- Hook arguments ---------------------------------------------------------

export interface UseEditorShellStateArgs<TMeta, TEntity extends EntityLike> {
  mode: 'create' | 'edit'
  /** `'post' | 'page'` — drives body-key prefixes and route stubs. */
  entityKind: 'post' | 'page'

  /** Pre-loaded detail (edit-mode only). */
  detail?: {
    entity: TEntity
    latestRevision: RevisionLike | null
    publishedRevision: RevisionLike | null
  }

  // Meta drafting
  emptyMeta: TMeta
  metaDraftFromEntity: (entity: TEntity) => TMeta
  metaDraftsEqual: (a: TMeta, b: TMeta) => boolean

  // Local-storage draft hook factories — Shell passes the
  // per-entity hook functions (`usePostLocalDraft` /
  // `usePageLocalDraft` etc); the state hook calls them inside its
  // own body so the LS payload sees the live body/meta state we own
  // here, without forcing the Shell to forward-declare them.
  useLocalDraftHook: (input: {
    entityId: string | null
    clientRevisionToken: string | null
    body: PortableTextBody
    disabled: boolean
  }) => { loadedDraft: { body: PortableTextBody; savedAt: number } | null; clearDraft: () => void }
  useCreateDraftHook: (input: { body: PortableTextBody; meta: TMeta }) => {
    loadedDraft: { meta: TMeta; body: PortableTextBody; savedAt: number } | null
    migrateToEditKey: (id: string, token: string, body: PortableTextBody) => void
  }

  // Mutation function bindings — Shell wraps the entity-specific
  // oRPC endpoints and normalises the response to `{ entity }` /
  // `SaveBodyOutput`. The hook owns the `useMutation()` calls + the
  // onSuccess/onError handlers internally so it can wire them into
  // its status machine without TDZ gymnastics.
  upsertMetaFn: (input: Record<string, unknown>) => Promise<TEntity>
  saveDraftFn: (input: Record<string, unknown>) => Promise<SaveBodyOutput>
  publishFn: (input: Record<string, unknown>) => Promise<SaveBodyOutput>
  unpublishFn: (input: { id: string }) => Promise<TEntity>

  /**
   * Build the upsertMeta payload from the meta draft. Post passes
   * `pinnedAt`, `category`, `tags`, `alias`; page passes `showFriends`.
   * Common fields (`title`, `summary`, `cover`, `og`, `published`,
   * `commentsEnabled`, `showToc`, `showUpdated`, `slug`, `publishedAt`)
   * are built here from `meta`.
   */
  buildUpsertMetaPayload: (input: { meta: TMeta; id?: string; publishedAt: string | null }) => Record<string, unknown>

  /**
   * Direct oRPC `saveDraft` for autosave + force-save (adoptLocalDraft).
   * `useMutation.mutate()` doesn't return a promise so we need a raw
   * caller for the await-driven flows.
   */
  directSaveDraft: (input: {
    id: string
    body: PortableTextBody
    expectedClientRevisionToken: string | null
    force?: boolean
  }) => Promise<SaveBodyOutput>

  // Routing
  editPath: (id: string) => string
  navigate: NavigateFunction
}

// --- Hook output ------------------------------------------------------------

export interface UseEditorShellStateOutput<TMeta> {
  // Body + meta drafts
  meta: TMeta
  setMeta: React.Dispatch<React.SetStateAction<TMeta>>
  body: PortableTextBody
  setBody: React.Dispatch<React.SetStateAction<PortableTextBody>>
  bodyKey: string
  initialBody: PortableTextBody

  // Convenience: `mode === 'edit' && detail !== undefined`
  isEditing: boolean

  // Status chip
  status: EditorShellStatus
  sidebarSaveStatus: SidebarSaveStatus

  // Visibility toggles
  previewOpen: boolean
  setPreviewOpen: (updater: boolean | ((prev: boolean) => boolean)) => void
  metaOpen: boolean
  setMetaOpen: React.Dispatch<React.SetStateAction<boolean>>
  isLg: boolean

  // Refs for scroll sync — Shell hands them to PreviewPanel /
  // PageBodyEditor.
  editorScrollRef: React.RefObject<HTMLDivElement | null>
  previewScrollRef: React.RefObject<HTMLDivElement | null>

  // Conflict dialog state
  conflict: { localBody: PortableTextBody; localSavedAt: number } | null

  // Banner
  previewBanner: { kind: 'draft' | 'published'; slug: string } | null
  dismissPreviewBanner: () => void

  // Create-mode LS draft savedAt timestamp (for the create-mode
  // banner). The Shell doesn't see the hook's internal createDraft
  // result directly; we surface this single field instead.
  createDraftSavedAt: number | null

  // Mutation pending flags
  isPending: boolean
  isSavingDraft: boolean
  isPublishing: boolean
  isUnpublishing: boolean
  isCreating: boolean

  // Derived flags
  canPersistMeta: boolean
  canPublish: boolean
  publishState: PublishState
  sidebarPublishStatus: SidebarPublishStatus | null
  sidebarRevisionSummary: SidebarRevisionSummary | null
  showPreviewPublicSyncHint: boolean
  expectedToken: string | null

  // Save handlers (bound to the Shell-provided mutations)
  persistCreate: () => Promise<void>
  persistSave: () => void
  persistPublish: () => void
  persistUnpublish: () => void

  // Conflict / history adoption handlers
  adoptLocalDraft: () => Promise<void>
  adoptServerVersion: () => void
  adoptRevisionFromHistory: (revision: { body: PortableTextBody; revisionNo: number }) => void

  // Reducers exposed so the Shell can wire mutation onSuccess to the
  // hook's status machine. These are stable identities (memoised
  // inside the hook).
  onMetaSaved: (entity: EntityLike) => void
  onBodySaved: (payload: SaveBodyOutput) => void
  onUnpublishSaved: (entity: EntityLike, freshMeta: TMeta) => void
  noteError: (message: string) => void
}

// --- Helpers ---------------------------------------------------------------

interface AutosavePendingArg {
  upsertMetaApi: { isPending: boolean }
  saveDraftApi: { isPending: boolean }
  publishApi: { isPending: boolean }
  unpublishApi: { isPending: boolean }
}

function isPendingForAutosave({ upsertMetaApi, saveDraftApi, publishApi, unpublishApi }: AutosavePendingArg): boolean {
  return upsertMetaApi.isPending || saveDraftApi.isPending || publishApi.isPending || unpublishApi.isPending
}

function derivePublishState(
  latest: RevisionLike | null,
  published: RevisionLike | null,
  visible: boolean,
): PublishState {
  if (latest === null) {
    return { kind: 'not-published-yet' }
  }
  if (!visible) {
    return { kind: 'unpublished', lastPublishedRevisionNo: published?.revisionNo ?? null }
  }
  if (latest.status === 'published') {
    return { kind: 'published-current', revisionNo: latest.revisionNo }
  }
  return {
    kind: 'draft-ahead',
    draftRevisionNo: latest.revisionNo,
    publishedRevisionNo: published?.revisionNo ?? null,
  }
}

// `localInputValueToIso` parses the picker's local-tz string into ISO.
// Both Post + Page sidebars export the same helper; we accept it as a
// closure callback rather than duplicating the implementation here.
// Shell binds it via `args.toPublishedAtIso` … actually no, the
// callsites all use `meta.publishedAt` directly. We accept the parsed
// ISO from the Shell so the hook stays agnostic of input formatting.
function parseLocalDateTime(localValue: string): number {
  return localValue === '' ? Number.NaN : Date.parse(localValue)
}

// --- Hook -------------------------------------------------------------------

/**
 * Shared state machine for the post + page editor shells. Owns:
 *
 *  - body + meta drafts (with persistence baselines)
 *  - layout toggles (preview, meta panel, lg breakpoint)
 *  - revision token + last-loaded snapshots
 *  - draft conflict detection vs local-storage payload
 *  - autosave loop dispatch
 *  - persistSave / persistPublish / persistCreate / persistUnpublish
 *  - keyboard shortcuts (Cmd/Ctrl+S, Cmd/Ctrl+Shift+P)
 *  - publish-state projection + sidebar status projections
 *
 * Per-entity differences (DTO key shape, API endpoint paths, mutation
 * payload fields, sidebar component) stay in the Shell — see
 * `PostEditorShell.tsx` / `PageEditorShell.tsx` for the wiring.
 */
export function useEditorShellState<
  TMeta extends { title: string; slug: string; published: boolean; publishedAt: string },
  TEntity extends EntityLike,
>(args: UseEditorShellStateArgs<TMeta, TEntity>): UseEditorShellStateOutput<TMeta> {
  const {
    mode,
    entityKind: _entityKind,
    detail,
    emptyMeta,
    metaDraftFromEntity,
    metaDraftsEqual,
    useLocalDraftHook,
    useCreateDraftHook,
    upsertMetaFn,
    saveDraftFn,
    publishFn,
    unpublishFn,
    buildUpsertMetaPayload,
    directSaveDraft,
    editPath,
    navigate,
  } = args

  const isEditing = mode === 'edit' && detail !== undefined

  // --- Meta draft -----------------------------------------------------------
  const [meta, setMeta] = useState<TMeta>(isEditing ? metaDraftFromEntity(detail.entity) : emptyMeta)

  // --- Body draft -----------------------------------------------------------
  const initialBody = useMemo<PortableTextBody>(() => {
    if (!isEditing) {
      return []
    }
    return (detail.latestRevision ?? detail.publishedRevision)?.body ?? []
  }, [isEditing, detail])
  const [body, setBody] = useState<PortableTextBody>(initialBody)

  const initialBodyKey = useMemo(() => {
    if (!isEditing) {
      return 'create:initial'
    }
    const rev = detail.latestRevision ?? detail.publishedRevision
    return rev !== null ? `${detail.entity.id}:${rev.clientRevisionToken}` : `${detail.entity.id}:empty`
  }, [isEditing, detail])
  const [bodyKey, setBodyKey] = useState(initialBodyKey)

  // --- Live preview pane ----------------------------------------------------
  const [previewOpen, setPreviewOpenState] = useState(false)
  useAdminChromeFocus(previewOpen)
  // Lift the shared ScrollTop FAB throughout the editor session so it
  // clears the bottom-right publish FAB (`FloatingPublishButton`)
  // whenever the operator scrolls past the inline toolbar.
  useAdminScrollTopLift(true)

  const editorScrollRef = useRef<HTMLDivElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  useSyncScroll({ editorRef: editorScrollRef, previewRef: previewScrollRef, enabled: previewOpen })

  // `isLg` + `metaOpen` are deliberately driven from a single inline
  // `matchMedia` listener instead of the shared `useMediaQuery`
  // hook. The reason: when the viewport crosses OUT of `lg` we MUST
  // collapse the meta panel in the same render that flips `isLg` to
  // `false`, otherwise the Sheet (about to take over from the inline
  // aside) renders one frame with `open=true`, attaches its scrim
  // backdrop, and then closes on the next effect tick — leaving a
  // stuck transparent overlay that swallows every click on the
  // editor. Calling `setIsLg(false)` and `setMetaOpen(false)` from
  // the same matchMedia change handler lets React 18 auto-batch the
  // updates into one commit.
  const [isLg, setIsLg] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    return window.matchMedia('(min-width: 1024px)').matches
  })
  const [metaOpen, setMetaOpen] = useState(isLg)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    setIsLg(mql.matches)
    const handleChange = (event: MediaQueryListEvent) => {
      setIsLg(event.matches)
      if (!event.matches) {
        setMetaOpen(false)
        setPreviewOpenState(false)
      }
    }
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  // We sync `metaOpen` ↔ `previewOpen` synchronously inside the
  // toggle setter rather than via `useEffect`. An effect-driven sync
  // would briefly mount `<Sheet open>` while `previewOpen=true` and
  // `metaOpen` is still the stale `true`, leaving Base UI's backdrop
  // attached after the close animation — which blocks every click on
  // the entity underneath.
  const setPreviewOpen = useCallback((updater: boolean | ((prev: boolean) => boolean)) => {
    setPreviewOpenState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setMetaOpen(!next)
      return next
    })
  }, [])

  // --- Revision tokens + mirrors -------------------------------------------
  const [expectedToken, setExpectedToken] = useState<string | null>(
    isEditing ? ((detail.latestRevision ?? detail.publishedRevision)?.clientRevisionToken ?? null) : null,
  )
  const [latestRevision, setLatestRevision] = useState<RevisionLike | null>(isEditing ? detail.latestRevision : null)
  const [publishedRevision, setPublishedRevision] = useState<RevisionLike | null>(
    isEditing ? detail.publishedRevision : null,
  )
  // Mirror of `entity.publishedAt` that follows meta save round-trips.
  // We need it to detect "operator just switched out of 定时发布
  // mode" — `meta.publishedAt === ''` is ambiguous on its own.
  const [serverPublishedAtIso, setServerPublishedAtIso] = useState<string | null>(
    isEditing ? detail.entity.publishedAt : null,
  )

  // --- Status chip ---------------------------------------------------------
  const [status, setStatus] = useState<EditorShellStatus>({ kind: 'idle' })
  const [displaySaveAtMs, setDisplaySaveAtMs] = useState<number | null>(() => {
    if (!isEditing || detail === undefined) {
      return null
    }
    const iso = (detail.latestRevision ?? detail.publishedRevision)?.updatedAt ?? detail.entity.updatedAt
    const ms = Date.parse(iso)
    return Number.isNaN(ms) ? null : ms
  })

  // --- Baselines (for dirty + skip-no-op-save) -----------------------------
  const lastPersistedMetaRef = useRef<TMeta>(
    isEditing && detail !== undefined ? metaDraftFromEntity(detail.entity) : { ...emptyMeta },
  )
  const lastSavedBodyRef = useRef<PortableTextBody>(initialBody)

  // --- LS draft hooks (called with the live body/meta we own) -------------
  const { loadedDraft: loadedLocalDraft, clearDraft: clearLocalDraft } = useLocalDraftHook({
    entityId: isEditing ? detail.entity.id : null,
    clientRevisionToken: expectedToken,
    body,
    disabled: !isEditing,
  })
  const createDraft = useCreateDraftHook({ body, meta })

  // --- Banner (post-save preview link) -------------------------------------
  const pendingActionRef = useRef<{ kind: 'draft' | 'published'; remaining: number } | null>(null)
  const [previewBanner, setPreviewBanner] = useState<{ kind: 'draft' | 'published'; slug: string } | null>(null)
  const dismissPreviewBanner = useCallback(() => setPreviewBanner(null), [])
  const noteActionLegSucceeded = useCallback((slugForBanner: string) => {
    const pending = pendingActionRef.current
    if (pending === null) {
      return
    }
    pending.remaining -= 1
    if (pending.remaining > 0) {
      return
    }
    const kind = pending.kind
    pendingActionRef.current = null
    setPreviewBanner({ kind, slug: slugForBanner })
  }, [])
  const cancelActionBanner = useCallback(() => {
    pendingActionRef.current = null
  }, [])

  // --- Create-mode LS hydration --------------------------------------------
  const createDraftHydratedRef = useRef(false)
  useEffect(() => {
    if (isEditing) {
      return
    }
    if (createDraftHydratedRef.current) {
      return
    }
    if (createDraft.loadedDraft === null) {
      createDraftHydratedRef.current = true
      return
    }
    createDraftHydratedRef.current = true
    setMeta(createDraft.loadedDraft.meta)
    setBody(createDraft.loadedDraft.body)
    setBodyKey(`create:restored:${createDraft.loadedDraft.savedAt}`)
  }, [isEditing, createDraft.loadedDraft])

  // --- Conflict detection (edit mode) --------------------------------------
  const [conflict, setConflict] = useState<{ localBody: PortableTextBody; localSavedAt: number } | null>(null)
  const [conflictResolved, setConflictResolved] = useState(false)
  useEffect(() => {
    if (conflictResolved) {
      return
    }
    if (loadedLocalDraft === null) {
      return
    }
    if (arePortableTextBodiesEquivalent(loadedLocalDraft.body, initialBody)) {
      return
    }
    setConflict({ localBody: loadedLocalDraft.body, localSavedAt: loadedLocalDraft.savedAt })
  }, [loadedLocalDraft, initialBody, conflictResolved])

  // --- Save reducers (Shell wires these via mutation onSuccess) ------------
  const onMetaSaved = useCallback(
    (saved: EntityLike) => {
      setStatus({ kind: 'saved', at: new Date() })
      const freshMeta = metaDraftFromEntity(saved as TEntity)
      lastPersistedMetaRef.current = freshMeta
      const saveMs = Date.parse(saved.updatedAt)
      if (!Number.isNaN(saveMs)) {
        setDisplaySaveAtMs(saveMs)
      }
      setMeta(freshMeta)
      setServerPublishedAtIso(saved.publishedAt)
      noteActionLegSucceeded(saved.slug)
    },
    [metaDraftFromEntity, noteActionLegSucceeded],
  )

  const onBodySaved = useCallback(
    (payload: SaveBodyOutput) => {
      if (payload.status === 'conflict') {
        setStatus({ kind: 'conflict', expectedToken: payload.expectedToken })
        cancelActionBanner()
        return
      }
      setStatus({ kind: 'saved', at: new Date() })
      const saveMs = Date.parse(payload.revision.updatedAt)
      if (!Number.isNaN(saveMs)) {
        setDisplaySaveAtMs(saveMs)
      }
      const slugForBanner = meta.slug.trim() === '' ? (detail?.entity.slug ?? '') : meta.slug.trim()
      noteActionLegSucceeded(slugForBanner)
      setExpectedToken(payload.revision.clientRevisionToken)
      setLatestRevision(payload.revision)
      if (payload.revision.status === 'published') {
        setPublishedRevision(payload.revision)
      }
      lastSavedBodyRef.current = payload.revision.body
    },
    [meta.slug, detail, cancelActionBanner, noteActionLegSucceeded],
  )

  const onUnpublishSaved = useCallback((saved: EntityLike, freshMeta: TMeta) => {
    setStatus({ kind: 'saved', at: new Date() })
    lastPersistedMetaRef.current = freshMeta
    const saveMs = Date.parse(saved.updatedAt)
    if (!Number.isNaN(saveMs)) {
      setDisplaySaveAtMs(saveMs)
    }
    setMeta(freshMeta)
    setServerPublishedAtIso(saved.publishedAt)
    // Take the entity offline = drop any leftover banner; the public
    // URL is no longer accessible.
    setPreviewBanner(null)
  }, [])

  const noteError = useCallback(
    (message: string) => {
      setStatus({ kind: 'error', message })
      cancelActionBanner()
    },
    [cancelActionBanner],
  )

  // --- Mutations (hook-owned so onSuccess can wire into reducers
  //     without TDZ) -------------------------------------------------------
  const upsertMetaMutation = useMutation({
    mutationFn: upsertMetaFn,
    onSuccess: (saved) => onMetaSaved(saved),
    onError: (error) => noteError(error.message),
  })
  const saveDraftMutation = useMutation({
    mutationFn: saveDraftFn,
    onSuccess: (payload) => onBodySaved(payload),
    onError: (error) => noteError(error.message),
  })
  const publishMutation = useMutation({
    mutationFn: publishFn,
    onSuccess: (payload) => {
      onBodySaved(payload)
      // Server-side publish flips `meta.published = true` in the
      // same transaction as promoting the revision. Mirror locally
      // so the badge + toolbar swap immediately, without waiting
      // for a route refresh.
      if (payload.status === 'saved') {
        setMeta((m) => ({ ...m, published: true }))
      }
    },
    onError: (error) => noteError(error.message),
  })
  const unpublishMutation = useMutation({
    mutationFn: unpublishFn,
    onSuccess: (saved) => onUnpublishSaved(saved, metaDraftFromEntity(saved as TEntity)),
    onError: (error) => noteError(error.message),
  })

  // --- Autosave ------------------------------------------------------------
  const autosaveEnabled =
    isEditing &&
    conflict === null &&
    !isPendingForAutosave({
      upsertMetaApi: upsertMetaMutation,
      saveDraftApi: saveDraftMutation,
      publishApi: publishMutation,
      unpublishApi: unpublishMutation,
    })
  // The `onBodySaved` reducer reads from a closure that captures
  // `detail`, `expectedToken`, etc. We mirror it through a ref so the
  // autosave flush always picks up the latest values without forcing
  // every keystroke to recreate the flush callback.
  const handleBodySavedRef = useRef<(payload: SaveBodyOutput) => void>(() => undefined)
  handleBodySavedRef.current = onBodySaved

  const flushAutosave = useCallback(
    async (snapshot: PortableTextBody) => {
      if (!isEditing) {
        return
      }
      try {
        const result = await directSaveDraft({
          id: detail.entity.id,
          body: snapshot,
          expectedClientRevisionToken: expectedToken,
        })
        handleBodySavedRef.current(result)
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : '保存失败')
      }
    },
    [isEditing, detail, expectedToken, directSaveDraft],
  )

  useAutosave({
    body,
    enabled: autosaveEnabled,
    flush: flushAutosave,
    onStatusChange: (autosaveStatus: AutosaveStatus) => {
      if (autosaveStatus.kind === 'saving') {
        setStatus({ kind: 'saving' })
      } else if (autosaveStatus.kind === 'saved') {
        setStatus({ kind: 'saved', at: new Date(autosaveStatus.at) })
      } else if (autosaveStatus.kind === 'retrying') {
        setStatus({ kind: 'error', message: autosaveStatus.message })
      }
    },
  })

  // --- Persist handlers ----------------------------------------------------
  const [isCreating, setIsCreating] = useState(false)
  const persistCreate = useCallback(async () => {
    if (isEditing || isCreating) {
      return
    }
    setIsCreating(true)
    setStatus({ kind: 'saving' })

    const publishedAt = localInputValueToIso(meta.publishedAt)
    let savedEntity: EntityLike
    try {
      savedEntity = (await upsertMetaMutation.mutateAsync(buildUpsertMetaPayload({ meta, publishedAt }))) as EntityLike
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : '保存失败' })
      setIsCreating(false)
      return
    }

    let draftResult: SaveBodyOutput
    try {
      draftResult = await directSaveDraft({
        id: savedEntity.id,
        body,
        expectedClientRevisionToken: null,
      })
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : '保存正文失败' })
      setIsCreating(false)
      void navigate(editPath(savedEntity.id), { replace: true })
      return
    }
    if (draftResult.status === 'conflict') {
      setStatus({ kind: 'conflict', expectedToken: draftResult.expectedToken })
      setIsCreating(false)
      void navigate(editPath(savedEntity.id), { replace: true })
      return
    }

    createDraft.migrateToEditKey(savedEntity.id, draftResult.revision.clientRevisionToken, body)
    lastSavedBodyRef.current = draftResult.revision.body

    setStatus({ kind: 'saved', at: new Date() })
    setIsCreating(false)
    void navigate(editPath(savedEntity.id), { replace: true })
  }, [
    isEditing,
    isCreating,
    meta,
    body,
    upsertMetaMutation,
    directSaveDraft,
    createDraft,
    buildUpsertMetaPayload,
    editPath,
    navigate,
  ])

  const persistSave = useCallback(() => {
    if (!isEditing) {
      return
    }
    setStatus({ kind: 'saving' })
    const pickerIso = localInputValueToIso(meta.publishedAt)
    const serverIsScheduled = serverPublishedAtIso !== null && (Date.parse(serverPublishedAtIso) || 0) > Date.now()
    const publishedAt = pickerIso !== null ? pickerIso : serverIsScheduled ? new Date().toISOString() : null
    const bodyDiverged = !arePortableTextBodiesEquivalent(body, lastSavedBodyRef.current)
    pendingActionRef.current = { kind: 'draft', remaining: bodyDiverged ? 2 : 1 }
    upsertMetaMutation.mutate(buildUpsertMetaPayload({ meta, id: detail.entity.id, publishedAt }))
    if (bodyDiverged) {
      saveDraftMutation.mutate({
        id: detail.entity.id,
        body,
        expectedClientRevisionToken: expectedToken,
      })
    }
  }, [
    isEditing,
    detail,
    meta,
    body,
    expectedToken,
    serverPublishedAtIso,
    upsertMetaMutation,
    saveDraftMutation,
    buildUpsertMetaPayload,
  ])

  const persistPublish = useCallback(() => {
    if (!isEditing) {
      setStatus({ kind: 'error', message: '请先保存基本信息再发布。' })
      return
    }
    setStatus({ kind: 'saving' })
    const publishedAtIso = localInputValueToIso(meta.publishedAt)
    pendingActionRef.current = { kind: 'published', remaining: 1 }
    publishMutation.mutate({
      id: detail.entity.id,
      body,
      expectedClientRevisionToken: expectedToken,
      ...(publishedAtIso !== null ? { publishedAt: publishedAtIso } : {}),
    })
    setServerPublishedAtIso(publishedAtIso ?? new Date().toISOString())
  }, [isEditing, detail, body, expectedToken, meta.publishedAt, publishMutation])

  const persistUnpublish = useCallback(() => {
    if (!isEditing) {
      return
    }
    setStatus({ kind: 'saving' })
    unpublishMutation.mutate({ id: detail.entity.id })
  }, [isEditing, detail, unpublishMutation])

  // --- Derived flags + projections -----------------------------------------
  const publishState = useMemo<PublishState>(
    () =>
      isEditing ? derivePublishState(latestRevision, publishedRevision, meta.published) : { kind: 'not-published-yet' },
    [isEditing, latestRevision, publishedRevision, meta.published],
  )

  const showPreviewPublicSyncHint = useMemo(() => {
    if (!isEditing) {
      return false
    }
    if (publishState.kind === 'draft-ahead') {
      return true
    }
    return !arePortableTextBodiesEquivalent(body, lastSavedBodyRef.current)
  }, [isEditing, body, publishState])

  const sidebarPublishStatus = useMemo<SidebarPublishStatus | null>(() => {
    if (!isEditing) {
      return 'never-saved'
    }
    if (publishState.kind === 'not-published-yet') {
      return 'never-saved'
    }
    if (publishState.kind === 'unpublished') {
      return 'offline'
    }
    const ts = parseLocalDateTime(meta.publishedAt)
    const isFuture = !Number.isNaN(ts) && ts > Date.now()
    if (isFuture) {
      return 'scheduled'
    }
    return publishState.kind === 'draft-ahead' ? 'live-with-draft-ahead' : 'live'
  }, [isEditing, publishState, meta.publishedAt])

  // --- Keyboard shortcuts --------------------------------------------------
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
          persistSave()
        }
        return
      }
      if (key === 'p' && event.shiftKey) {
        event.preventDefault()
        if (!isEditing) {
          return
        }
        if (publishState.kind !== 'published-current') {
          persistPublish()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, isEditing, persistCreate, persistSave, persistPublish, publishState])

  // --- Mutation pending flags ----------------------------------------------
  const isSubmittingAny =
    upsertMetaMutation.isPending ||
    saveDraftMutation.isPending ||
    publishMutation.isPending ||
    unpublishMutation.isPending
  const isPending = isSubmittingAny || isCreating
  const isSavingDraft = upsertMetaMutation.isPending || saveDraftMutation.isPending
  const isPublishing = publishMutation.isPending
  const isUnpublishing = unpublishMutation.isPending

  // --- Conflict / history adoption handlers -------------------------------
  const adoptLocalDraft = useCallback(async () => {
    if (conflict === null || !isEditing) {
      return
    }
    setBody(conflict.localBody)
    setBodyKey(`${detail.entity.id}:adopt-local:${Date.now()}`)
    setConflict(null)
    setConflictResolved(true)
    setStatus({ kind: 'saving' })
    try {
      const result = await directSaveDraft({
        id: detail.entity.id,
        body: conflict.localBody,
        expectedClientRevisionToken: expectedToken,
        force: true,
      })
      handleBodySavedRef.current(result)
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : '保存失败' })
    }
  }, [conflict, isEditing, detail, expectedToken, directSaveDraft])

  const adoptServerVersion = useCallback(() => {
    setBody(initialBody)
    setBodyKey(`${detail?.entity.id ?? 'new'}:adopt-server:${Date.now()}`)
    lastSavedBodyRef.current = initialBody
    clearLocalDraft()
    setConflict(null)
    setConflictResolved(true)
  }, [initialBody, detail, clearLocalDraft])

  const adoptRevisionFromHistory = useCallback(
    (revision: { body: PortableTextBody; revisionNo: number }) => {
      if (!isEditing) {
        return
      }
      setBody(revision.body)
      setBodyKey(`${detail.entity.id}:adopt-revision:${revision.revisionNo}:${Date.now()}`)
      setStatus({ kind: 'info', message: `已载入 R${revision.revisionNo}，记得保存或发布以生效。` })
    },
    [isEditing, detail],
  )

  // --- Sidebar projection (revision summary + save status) ----------------
  const canPersistMeta = meta.title.trim() !== ''
  const canPublish = isEditing && publishState.kind !== 'published-current'

  const sidebarRevisionSummary = useMemo<SidebarRevisionSummary | null>(() => {
    if (!isEditing) {
      return null
    }
    switch (publishState.kind) {
      case 'not-published-yet':
        return { kind: 'no-revision' }
      case 'published-current':
        return { kind: 'published-current', revisionNo: publishState.revisionNo }
      case 'unpublished':
        return publishState.lastPublishedRevisionNo !== null
          ? { kind: 'published-current', revisionNo: publishState.lastPublishedRevisionNo }
          : { kind: 'no-revision' }
      case 'draft-ahead':
        return {
          kind: 'draft-ahead',
          draftRevisionNo: publishState.draftRevisionNo,
          publishedRevisionNo: publishState.publishedRevisionNo,
        }
    }
  }, [isEditing, publishState])

  const isBodyDirty = !arePortableTextBodiesEquivalent(body, lastSavedBodyRef.current)
  const isMetaDirty = !metaDraftsEqual(meta, lastPersistedMetaRef.current)
  const sidebarSaveStatus = useMemo<SidebarSaveStatus>(() => {
    if (status.kind === 'saving') {
      return { kind: 'saving' }
    }
    if (status.kind === 'error') {
      return { kind: 'error', message: status.message }
    }
    if (status.kind === 'conflict') {
      return { kind: 'conflict' }
    }
    if (status.kind === 'info') {
      return { kind: 'info', message: status.message }
    }
    if (!isEditing) {
      return { kind: 'unsaved' }
    }
    if (isBodyDirty || isMetaDirty) {
      return { kind: 'unsaved' }
    }
    if (displaySaveAtMs !== null) {
      return { kind: 'saved', atMs: displaySaveAtMs }
    }
    return { kind: 'unsaved' }
  }, [status, isEditing, isBodyDirty, isMetaDirty, displaySaveAtMs])

  return {
    meta,
    setMeta,
    body,
    setBody,
    bodyKey,
    initialBody,
    isEditing,

    status,
    sidebarSaveStatus,

    previewOpen,
    setPreviewOpen,
    metaOpen,
    setMetaOpen,
    isLg,

    editorScrollRef,
    previewScrollRef,

    conflict,

    previewBanner,
    dismissPreviewBanner,
    createDraftSavedAt: createDraft.loadedDraft?.savedAt ?? null,

    isPending,
    isSavingDraft,
    isPublishing,
    isUnpublishing,
    isCreating,

    canPersistMeta,
    canPublish,
    publishState,
    sidebarPublishStatus,
    sidebarRevisionSummary,
    showPreviewPublicSyncHint,
    expectedToken,

    persistCreate,
    persistSave,
    persistPublish,
    persistUnpublish,

    adoptLocalDraft,
    adoptServerVersion,
    adoptRevisionFromHistory,

    onMetaSaved,
    onBodySaved,
    onUnpublishSaved,
    noteError,
  }
}

// Re-export a generic ISO parser so both shells use the same helper
// without each sidebar exporting its own copy. The sidebars still
// export their own `localInputValueToIso` for backwards compatibility,
// but the hook accepts the parsed string directly.
function localInputValueToIso(localValue: string): string | null {
  if (localValue === '') {
    return null
  }
  const ms = Date.parse(localValue)
  if (Number.isNaN(ms)) {
    return null
  }
  return new Date(ms).toISOString()
}
