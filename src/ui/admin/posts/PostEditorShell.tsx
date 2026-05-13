import type { NavigateFunction } from 'react-router'

import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  EyeOffIcon,
  Loader2Icon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  SaveIcon,
  SlidersHorizontalIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import type {
  AdminPostDetailDto,
  AdminPostDto,
  AdminRevisionDto,
  SavePostBodyInput,
  SavePostBodyOutput,
  UnpublishPostInput,
  UnpublishPostOutput,
  UpsertPostMetaInput,
  UpsertPostMetaOutput,
} from '@/shared/cms-posts'
import type { PortableTextBody } from '@/shared/pt/schema'

import { useApiFetcher } from '@/client/api/fetcher'
import { submitApiAction } from '@/client/api/submit'
import { useCreatePostDraft } from '@/client/hooks/use-create-post-draft'
import { usePostAutosave } from '@/client/hooks/use-post-autosave'
import { usePostLocalDraft } from '@/client/hooks/use-post-local-draft'
import { useSyncScroll } from '@/client/hooks/use-sync-scroll'
import { API_ACTIONS } from '@/shared/api-actions'
import { arePortableTextBodiesEquivalent } from '@/shared/pt/bridge/canonicalize'
import { DraftConflictDialog } from '@/ui/admin/editor/DraftConflictDialog'
import { FloatingPublishButton } from '@/ui/admin/editor/FloatingPublishButton'
import { PageBodyEditor } from '@/ui/admin/editor/PageBodyEditor'
import { PreviewPane } from '@/ui/admin/pages/PreviewPane'
import { RevisionHistoryDrawer } from '@/ui/admin/pages/RevisionHistoryDrawer'
import {
  EMPTY_POST_META_DRAFT,
  localInputValueToIso,
  metaDraftFromPost,
  metaDraftsEqual,
  PostMetaSidebar,
  type PostMetaDraft,
  type SidebarPublishStatus,
  type SidebarRevisionSummary,
  type SidebarSaveStatus,
} from '@/ui/admin/posts/PostMetaSidebar'
import { useAdminChromeFocus, useAdminScrollTopLift } from '@/ui/admin/shell/AdminShell'
import { Button } from '@/ui/components/button'
import { Input } from '@/ui/components/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/components/sheet'
import { useContentSettings } from '@/ui/lib/blog-config-context'
import { cn } from '@/ui/lib/cn'

const UPSERT_META = API_ACTIONS.admin.upsertPostMeta
const SAVE_DRAFT = API_ACTIONS.admin.savePostDraft
const PUBLISH = API_ACTIONS.admin.publishPostLatest
const UNPUBLISH = API_ACTIONS.admin.unpublishPost

type Status =
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

export interface PostEditorShellProps {
  /**
   * Discriminator: `'create'` opens the editor in "new post" mode
   * (POSTs metadata first, then redirects to the edit URL). `'edit'`
   * loads the existing detail DTO and supports save/publish on the
   * body.
   */
  mode: 'create' | 'edit'
  /** Pre-loaded detail DTO. Only consulted when `mode === 'edit'`. */
  detail?: AdminPostDetailDto
  /** Navigation function injected from the route module. */
  navigate: NavigateFunction
}

// Top-level orchestrator for the post authoring screen. Owns the
// metadata draft, the body draft, and the save/publish/preview
// dispatch. Children stay focused: `PostMetaSidebar` is pure-props,
// `PageBodyEditor` receives a `bodyKey` so a remote-revision adoption
// flushes its content.
//
// Autosave / Local-Storage / diff-view / live preview all dock onto
// this shell as separate effects + components. This commit ships the
// metadata + manual save/publish skeleton; the autosave + LS + diff
// hooks plug in next.
export function PostEditorShell({ mode, detail, navigate }: PostEditorShellProps) {
  const isEditing = mode === 'edit' && detail !== undefined

  // Metadata draft mirrors the right-pane form. Initial state matches
  // the loaded DTO (edit) or the empty default (create).
  const contentSettings = useContentSettings()
  const featureEnabled = contentSettings.post.featureEnabled

  const [meta, setMeta] = useState<PostMetaDraft>(isEditing ? metaDraftFromPost(detail.post) : EMPTY_POST_META_DRAFT)

  // Body draft mirrors the editor pane. Falls back to the latest
  // revision (draft preferred over published) when opening an
  // existing post; an empty array on create.
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
    return rev !== null ? `${detail.post.id}:${rev.clientRevisionToken}` : `${detail.post.id}:empty`
  }, [isEditing, detail])
  const [bodyKey, setBodyKey] = useState(initialBodyKey)

  // Live-preview pane: when on, the editor lays out as
  // `[editor | preview | meta]` and tells the admin shell to
  // collapse its left navigation rail to give the three columns
  // breathing room. When off, the layout is the default
  // `[editor | meta]` and the rail comes back. State lives here so
  // it survives metadata edits but resets on route navigation.
  const [previewOpen, setPreviewOpenState] = useState(false)
  useAdminChromeFocus(previewOpen)
  // Lift the shared ScrollTop FAB throughout the editor session so it
  // clears the bottom-right publish FAB (`FloatingPublishButton`)
  // whenever the operator scrolls past the inline toolbar. Tied to
  // mount, not to `showFloatingToolbar`, because both FABs surface and
  // hide together as the operator scrolls — keeping the lift always-on
  // costs nothing visually (ScrollTop is opacity-0 until shown) and
  // avoids a render-time race where one FAB animates in before the
  // other has moved.
  useAdminScrollTopLift(true)

  const editorScrollRef = useRef<HTMLDivElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  useSyncScroll({ editorRef: editorScrollRef, previewRef: previewScrollRef, enabled: previewOpen })

  // `isLg` + `metaOpen` are deliberately driven from a single inline
  // `matchMedia` listener instead of the shared `useMediaQuery`
  // hook. The reason: when the viewport crosses OUT of `lg` (e.g.
  // the operator drags the browser narrow) we MUST collapse the
  // meta panel in the same render that flips `isLg` to `false`,
  // otherwise the Sheet (about to take over from the inline aside)
  // renders one frame with `open=true`, attaches its scrim backdrop,
  // and then closes on the next effect tick — leaving a stuck
  // transparent overlay that swallows every click on the editor.
  // Calling `setIsLg(false)` and `setMetaOpen(false)` from the same
  // matchMedia change handler lets React 18 auto-batch the updates
  // into one commit, so the Sheet only ever renders with the
  // already-closed state.
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
      }
    }
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])
  // We sync `metaOpen` ↔ `previewOpen` synchronously inside the
  // toggle setter rather than via `useEffect`. An effect-driven sync
  // would render once with `previewOpen=true` while `metaOpen` is
  // still the stale `true`, briefly mounting `<Sheet open>` and
  // leaving Base UI's backdrop attached after the close animation —
  // which blocks every click on the post underneath. See the bug
  // report on the live-preview backdrop persisting in the editor.
  const setPreviewOpen = useCallback((updater: boolean | ((prev: boolean) => boolean)) => {
    setPreviewOpenState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setMetaOpen(!next)
      return next
    })
  }, [])

  // The token the next save/publish must echo. Starts at the latest
  // revision's token; every successful save updates it.
  const [expectedToken, setExpectedToken] = useState<string | null>(
    isEditing ? ((detail.latestRevision ?? detail.publishedRevision)?.clientRevisionToken ?? null) : null,
  )
  // Mirror of `detail.latestRevision` / `detail.publishedRevision`
  // that follows save/publish round-trips. Without this, the
  // publish-state projection below stays stuck on the loader
  // snapshot — e.g. after saving a new draft on top of a published
  // post, the toolbar would still see "published-current" and keep
  // 发布 disabled. We update both refs from the save result so the
  // projection reflects the live server state without forcing a
  // full route reload.
  const [latestRevision, setLatestRevision] = useState<AdminRevisionDto | null>(
    isEditing ? detail.latestRevision : null,
  )
  const [publishedRevision, setPublishedRevision] = useState<AdminRevisionDto | null>(
    isEditing ? detail.publishedRevision : null,
  )
  // Mirror of `detail.post.publishedAt` that follows meta save
  // round-trips. We need it to detect "operator just switched out
  // of 定时发布 mode" — `meta.publishedAt === ''` is ambiguous on
  // its own (it also represents an already-published post sitting
  // in the past, where `metaDraftFromPost` blanks the picker on
  // purpose). When the persisted value is in the future and the
  // editor is now showing the empty picker, the unified 保存草稿
  // flow must send an explicit `publishedAt = now()` so the schedule
  // is actually cleared server-side; otherwise the upsertMeta payload
  // omits the field, the server preserves the stale future timestamp,
  // and the sidebar snaps right back to「已计划发布」after the round
  // trip.
  const [serverPublishedAtIso, setServerPublishedAtIso] = useState<string | null>(
    isEditing ? detail.post.publishedAt : null,
  )
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [displaySaveAtMs, setDisplaySaveAtMs] = useState<number | null>(() => {
    if (!isEditing || detail === undefined) {
      return null
    }
    const iso = (detail.latestRevision ?? detail.publishedRevision)?.updatedAt ?? detail.post.updatedAt
    const ms = Date.parse(iso)
    return Number.isNaN(ms) ? null : ms
  })
  const lastPersistedMetaRef = useRef<PostMetaDraft>(
    isEditing && detail !== undefined ? metaDraftFromPost(detail.post) : { ...EMPTY_POST_META_DRAFT },
  )

  // Tracks the body that's currently persisted server-side. Seeded
  // from the initially-loaded revision and updated after every
  // successful save (manual, autosave, or history-adoption push).
  // The unified 保存 button compares the live `body` against this
  // ref to decide whether the body half of the save round-trip
  // needs to run — when the editor's content equals the last
  // persisted body we skip `saveDraft` entirely so no empty
  // duplicate revision is created.
  const lastSavedBodyRef = useRef<PortableTextBody>(initialBody)

  // --- Local Storage draft persistence --------------------------------------
  // Edit mode keys on `(postId, clientRevisionToken)` so adopting a
  // remote revision (or saving) starts a fresh slot.
  const { loadedDraft, clearDraft } = usePostLocalDraft({
    postId: isEditing ? detail.post.id : null,
    clientRevisionToken: expectedToken,
    body,
    disabled: !isEditing,
  })

  // Create mode mirrors body + meta into a per-tab LS slot so closing
  // the tab mid-authoring doesn't lose work and a refresh restores
  // exactly where the user left off. Once the user clicks "create
  // post" we migrate the slot to the canonical edit-mode key shape.
  const createDraft = useCreatePostDraft({ body, meta })
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
    // Compare on canonical PT shape so semantically equivalent list
    // bodies (e.g. mixed-list representations) do not false-positive.
    if (arePortableTextBodiesEquivalent(loadedDraft.body, initialBody)) {
      return
    }
    setConflict({ localBody: loadedDraft.body, localSavedAt: loadedDraft.savedAt })
  }, [loadedDraft, initialBody, conflictResolved])

  // `create` mode chains upsertMeta → saveDraft → navigate, so it
  // can't piggy-back on `useApiFetcher` (which exposes a synchronous
  // `submit()` and an `onSuccess` callback). The chain runs through
  // `submitApiAction` instead and tracks its own pending flag.
  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const upsertMetaApi = useApiFetcher<UpsertPostMetaInput, UpsertPostMetaOutput>(UPSERT_META, {
    onSuccess: (payload) => onMetaSaved(payload.post),
    onError: (error) => {
      setStatus({ kind: 'error', message: error.message })
      cancelActionBanner()
    },
  })
  const saveDraftApi = useApiFetcher<SavePostBodyInput, SavePostBodyOutput>(SAVE_DRAFT, {
    onSuccess: (payload) => onBodySaved(payload),
    onError: (error) => {
      setStatus({ kind: 'error', message: error.message })
      cancelActionBanner()
    },
  })
  const publishApi = useApiFetcher<SavePostBodyInput, SavePostBodyOutput>(PUBLISH, {
    onSuccess: (payload) => {
      onBodySaved(payload)
      // Server-side publish flips `meta.published = true` in the
      // same transaction as promoting the revision. Mirror that
      // locally so the badge + toolbar swap to the published state
      // immediately, without waiting for a route refresh.
      if (payload.status === 'saved') {
        setMeta((m) => ({ ...m, published: true }))
      }
    },
    onError: (error) => {
      setStatus({ kind: 'error', message: error.message })
      cancelActionBanner()
    },
  })
  const unpublishApi = useApiFetcher<UnpublishPostInput, UnpublishPostOutput>(UNPUBLISH, {
    onSuccess: (payload) => {
      setStatus({ kind: 'saved', at: new Date() })
      lastPersistedMetaRef.current = metaDraftFromPost(payload.post)
      const saveMs = Date.parse(payload.post.updatedAt)
      if (!Number.isNaN(saveMs)) {
        setDisplaySaveAtMs(saveMs)
      }
      setMeta(metaDraftFromPost(payload.post))
      setServerPublishedAtIso(payload.post.publishedAt)
      // Take the post offline = drop any leftover banner; the
      // public URL is no longer accessible and the draft preview
      // is now redundant (the post itself has no `published`
      // baseline to overlay against).
      setPreviewBanner(null)
    },
    onError: (error) => setStatus({ kind: 'error', message: error.message }),
  })

  // --- Autosave -------------------------------------------------------------
  // Disabled while a save is in flight, while a conflict dialog is
  // pending resolution, or in `create` mode (no `id` to save against
  // yet). The flush hits `saveDraft` directly via `submitApiAction`
  // so the autosave can `await` each round-trip — `useApiFetcher`'s
  // sync `submit()` doesn't return a promise.
  const autosaveEnabled =
    isEditing && conflict === null && !isPendingForAutosave({ upsertMetaApi, saveDraftApi, publishApi, unpublishApi })
  // The `onBodySaved` reducer reads from a closure that captures
  // `detail`, `expectedToken`, etc. We mirror it through a ref so the
  // autosave flush always picks up the latest values without forcing
  // every keystroke to recreate the flush callback.
  const handleBodySavedRef = useRef<(payload: SavePostBodyOutput) => void>(() => undefined)
  handleBodySavedRef.current = (payload) => onBodySaved(payload)

  const flushAutosave = useCallback(
    async (snapshot: PortableTextBody) => {
      if (!isEditing) {
        return
      }
      const envelope = await submitApiAction<SavePostBodyInput, SavePostBodyOutput>(SAVE_DRAFT, {
        id: detail.post.id,
        body: snapshot,
        expectedClientRevisionToken: expectedToken,
      })
      if ('data' in envelope && envelope.data !== undefined) {
        handleBodySavedRef.current(envelope.data)
        return
      }
      if ('error' in envelope && envelope.error !== undefined) {
        // Rethrow so the autosave loop schedules a retry. The
        // editor's status indicator picks up the message via the
        // `onStatusChange` surface below.
        throw new Error(envelope.error.message)
      }
    },
    [isEditing, detail, expectedToken],
  )

  usePostAutosave({
    body,
    enabled: autosaveEnabled,
    flush: flushAutosave,
    onStatusChange: (autosaveStatus) => {
      if (autosaveStatus.kind === 'saving') {
        setStatus({ kind: 'saving' })
      } else if (autosaveStatus.kind === 'saved') {
        setStatus({ kind: 'saved', at: new Date(autosaveStatus.at) })
      } else if (autosaveStatus.kind === 'retrying') {
        setStatus({ kind: 'error', message: autosaveStatus.message })
      }
    },
  })

  function onMetaSaved(saved: AdminPostDto) {
    // `useApiFetcher.onSuccess` is the edit-mode path. Create mode
    // routes through `persistCreate()` instead — the `submit()` call
    // there bypasses this callback by using `submitApiAction`.
    setStatus({ kind: 'saved', at: new Date() })
    lastPersistedMetaRef.current = metaDraftFromPost(saved)
    const saveMs = Date.parse(saved.updatedAt)
    if (!Number.isNaN(saveMs)) {
      setDisplaySaveAtMs(saveMs)
    }
    setMeta(metaDraftFromPost(saved))
    setServerPublishedAtIso(saved.publishedAt)
    // Use the freshly-saved slug for the banner — the operator may
    // have just renamed the URL via the meta form, in which case
    // the loader's `detail.post.slug` is now stale.
    noteActionLegSucceeded(saved.slug)
  }

  function onBodySaved(payload: SavePostBodyOutput) {
    if (payload.status === 'conflict') {
      setStatus({ kind: 'conflict', expectedToken: payload.expectedToken })
      // A conflict means the server rejected the save; revoke the
      // pending preview-banner intent so the operator doesn't see
      // a "草稿已保存" toast for content that didn't actually land.
      cancelActionBanner()
      // The diff resolver UI is a follow-up. For now we stop the
      // flow and surface the conflict so the user knows there's a
      // newer revision they need to rebase against.
      return
    }
    setStatus({ kind: 'saved', at: new Date() })
    const saveMs = Date.parse(payload.revision.updatedAt)
    if (!Number.isNaN(saveMs)) {
      setDisplaySaveAtMs(saveMs)
    }
    // Body-side success — the slug isn't on the body payload, fall
    // back to the latest known meta slug (still in `meta.slug`,
    // which `onMetaSaved` will have refreshed if both legs landed).
    // `detail` is always defined on the body-save path (edit mode
    // only); the `?? ''` guard is purely for the TS narrowing.
    noteActionLegSucceeded(meta.slug.trim() === '' ? (detail?.post.slug ?? '') : meta.slug.trim())
    setExpectedToken(payload.revision.clientRevisionToken)
    // Mirror the saved revision into local state so the publish
    // state projection (and therefore the 发布 button's enabled
    // state) reflects what the server now holds — a fresh draft on
    // top of a published post must move the toolbar from
    // `published-current` to `draft-ahead` so 发布 re-enables.
    setLatestRevision(payload.revision)
    if (payload.revision.status === 'published') {
      setPublishedRevision(payload.revision)
    }
    // Intentionally do NOT bump `bodyKey` here. The editor's
    // content already matches what we just persisted, and any
    // edits the user typed between dispatching the save and the
    // server's reply are still in `body`. Bumping `bodyKey`
    // would re-fire `<PageBodyEditor>`'s reset effect, which
    // would call `setContent(bodyToPmDoc(initialBody))` — but
    // `initialBody` is the post-load snapshot, not the live
    // body — and silently wipe every keystroke since open. The
    // `bodyKey` lever is reserved for explicit content swaps:
    // adopting a remote revision, accepting a local draft from
    // the conflict resolver, restoring the create-mode LS slot,
    // or rewinding to a history revision.
    lastSavedBodyRef.current = payload.revision.body
  }

  // --- Save handlers ------------------------------------------------------

  // Two-step "create post" flow: upsert metadata to assign an id,
  // then push the locally-authored body to the brand-new post in a
  // single click. Once both succeed we migrate the LS slot to the
  // canonical edit-mode key shape and navigate to `/edit/:id` so
  // subsequent saves go through the regular edit-mode path.
  const persistCreate = useCallback(async () => {
    if (isEditing || isCreatingPost) {
      return
    }
    setIsCreatingPost(true)
    setStatus({ kind: 'saving' })

    const publishedAt = localInputValueToIso(meta.publishedAt)
    const metaEnvelope = await submitApiAction<UpsertPostMetaInput, UpsertPostMetaOutput>(UPSERT_META, {
      ...(meta.slug.trim() !== '' ? { slug: meta.slug.trim() } : {}),
      title: meta.title.trim(),
      summary: meta.summary.trim(),
      cover: meta.cover.trim(),
      og: meta.og.trim() === '' ? null : meta.og.trim(),
      published: meta.published,
      commentsEnabled: meta.commentsEnabled,
      showToc: meta.showToc,
      showUpdated: meta.showUpdated,
      visible: meta.visible,
      pinnedAt: meta.pinned ? new Date().toISOString() : null,
      category: meta.category,
      tags: meta.tags,
      alias: meta.alias,
      ...(publishedAt !== null ? { publishedAt } : {}),
    })
    if (!('data' in metaEnvelope) || metaEnvelope.data === undefined) {
      const errorMessage = 'error' in metaEnvelope && metaEnvelope.error ? metaEnvelope.error.message : '保存失败'
      setStatus({ kind: 'error', message: errorMessage })
      setIsCreatingPost(false)
      return
    }
    const savedPost = metaEnvelope.data.post

    // Push the body through `saveDraft`. `expectedClientRevisionToken: null`
    // because there's no revision yet — saveDraft creates the first one.
    const draftEnvelope = await submitApiAction<SavePostBodyInput, SavePostBodyOutput>(SAVE_DRAFT, {
      id: savedPost.id,
      body,
      expectedClientRevisionToken: null,
    })
    if (!('data' in draftEnvelope) || draftEnvelope.data === undefined) {
      const errorMessage =
        'error' in draftEnvelope && draftEnvelope.error ? draftEnvelope.error.message : '保存正文失败'
      setStatus({ kind: 'error', message: errorMessage })
      setIsCreatingPost(false)
      // The metadata row exists at this point so navigate the user
      // there — they can retry the body save from the edit screen.
      void navigate(`/wp-admin/posts/${savedPost.id}/edit`, { replace: true })
      return
    }
    if (draftEnvelope.data.status === 'conflict') {
      // A genuinely unreachable branch on a brand-new post — a fresh
      // row can't have a competing revision — but treat it as a
      // soft failure rather than crashing.
      setStatus({ kind: 'conflict', expectedToken: draftEnvelope.data.expectedToken })
      setIsCreatingPost(false)
      void navigate(`/wp-admin/posts/${savedPost.id}/edit`, { replace: true })
      return
    }

    // Migrate the LS slot from `cms-post-draft:new:<sessionId>` to
    // the edit-mode shape so a refresh on the edit screen still
    // loads the just-saved body without showing a conflict.
    createDraft.migrateToEditKey(savedPost.id, draftEnvelope.data.revision.clientRevisionToken, body)
    lastSavedBodyRef.current = draftEnvelope.data.revision.body

    setStatus({ kind: 'saved', at: new Date() })
    setIsCreatingPost(false)
    void navigate(`/wp-admin/posts/${savedPost.id}/edit`, { replace: true })
  }, [isEditing, isCreatingPost, meta, body, createDraft, navigate])

  // Post-action banner: surfaces below the toolbar after a manual
  // 保存草稿 / 发布草稿 *succeeds*. Two variants:
  //   - 'draft'     — amber banner, points at `/{slug}?draft=true`.
  //   - 'published' — green banner, points at `/{slug}`.
  // The banner stays put until the operator dismisses it (no
  // auto-hide); a follow-up successful action replaces the
  // existing one in place. We deliberately don't surface anything
  // on click — a save that gets rejected (validation error,
  // conflict, network failure) must NOT advertise a preview link,
  // otherwise the operator can land on the live post thinking the
  // latest body was persisted when it wasn't.
  //
  // `persistSave` / `persistPublish` may each fan out to multiple
  // submits in parallel; we only flash the banner once ALL pending
  // legs of the click have come back successfully, so a body
  // failure following a meta success doesn't leave a misleading
  // toast around. `pendingActionRef` records the click intent and
  // a counter of remaining success callbacks; a failure on any
  // leg zeros it out and the click silently drops the banner
  // (the failed leg's own error message takes the surface).
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

  // Unified 保存: meta is always pushed (and takes effect
  // immediately on the server), and the body is pushed as a new
  // draft revision only when it diverges from the
  // last-known-persisted body. The two round-trips run in parallel
  // and are tracked independently by their `useApiFetcher` slots.
  const persistSave = useCallback(() => {
    if (!isEditing) {
      return
    }
    setStatus({ kind: 'saving' })
    // Resolve the `publishedAt` value to send. The picker's blank
    // string normally maps to "omit ⇒ leave the persisted value
    // alone", but that turns the 定时→立即 toggle into a silent
    // no-op: the operator clears the schedule, hits 保存草稿, and
    // the next round trip re-hydrates the picker from the still-
    // future server value, snapping the badge back to「已计划发布」.
    // When the picker is empty AND the persisted value is in the
    // future, treat it as an explicit "publish immediately" intent
    // and stamp `now()` so the schedule is actually cleared.
    const pickerIso = localInputValueToIso(meta.publishedAt)
    const serverIsScheduled = serverPublishedAtIso !== null && (Date.parse(serverPublishedAtIso) || 0) > Date.now()
    const publishedAt = pickerIso !== null ? pickerIso : serverIsScheduled ? new Date().toISOString() : null
    const bodyDiverged = !arePortableTextBodiesEquivalent(body, lastSavedBodyRef.current)
    // Mark how many success callbacks must arrive before flashing
    // the draft-preview banner: meta always submits, body only
    // when it diverged from the last persisted snapshot.
    pendingActionRef.current = { kind: 'draft', remaining: bodyDiverged ? 2 : 1 }
    upsertMetaApi.submit({
      id: detail.post.id,
      ...(meta.slug.trim() !== '' ? { slug: meta.slug.trim() } : {}),
      title: meta.title.trim(),
      summary: meta.summary.trim(),
      cover: meta.cover.trim(),
      og: meta.og.trim() === '' ? null : meta.og.trim(),
      published: meta.published,
      commentsEnabled: meta.commentsEnabled,
      showToc: meta.showToc,
      showUpdated: meta.showUpdated,
      visible: meta.visible,
      pinnedAt: meta.pinned ? new Date().toISOString() : null,
      category: meta.category,
      tags: meta.tags,
      alias: meta.alias,
      ...(publishedAt !== null ? { publishedAt } : {}),
    })
    if (bodyDiverged) {
      saveDraftApi.submit({
        id: detail.post.id,
        body,
        expectedClientRevisionToken: expectedToken,
      })
    }
  }, [upsertMetaApi, saveDraftApi, isEditing, detail, meta, body, expectedToken, serverPublishedAtIso])

  const persistPublish = useCallback(() => {
    if (!isEditing) {
      setStatus({ kind: 'error', message: '请先保存文章信息再发布。' })
      return
    }
    setStatus({ kind: 'saving' })
    // `publishedAt` is optional on the wire: empty string ⇒ omit ⇒
    // server stamps `now()` (publish-immediately). A future ISO
    // timestamp parks the post as scheduled — the server still
    // promotes the revision, but the catalog filter
    // (`publishedAt <= now()`) hides the post until the time
    // arrives.
    const publishedAtIso = localInputValueToIso(meta.publishedAt)
    // 发布草稿 only fans out to a single fetcher (`publishApi`),
    // so the post-action banner is gated on that one success.
    pendingActionRef.current = { kind: 'published', remaining: 1 }
    publishApi.submit({
      id: detail.post.id,
      body,
      expectedClientRevisionToken: expectedToken,
      ...(publishedAtIso !== null ? { publishedAt: publishedAtIso } : {}),
    })
    // Mirror what the server is about to stamp: an explicit picker
    // value lands as-is; the omit path (立即发布) becomes `now()`.
    // Keeping `serverPublishedAtIso` in sync prevents the next
    // 保存草稿 from misreading the stale loader snapshot as "still
    // scheduled" and re-stamping `now()` redundantly.
    setServerPublishedAtIso(publishedAtIso ?? new Date().toISOString())
  }, [publishApi, isEditing, detail, body, expectedToken, meta.publishedAt])

  const persistUnpublish = useCallback(() => {
    if (!isEditing) {
      return
    }
    setStatus({ kind: 'saving' })
    unpublishApi.submit({ id: detail.post.id })
  }, [unpublishApi, isEditing, detail])

  const publishState = useMemo<PublishState>(
    // We pass `meta.published` separately because `detail.post.published`
    // is the snapshot from the loader and doesn't follow our
    // post-publish / post-unpublish state updates. The shell owns
    // the current truth in `meta`. `latestRevision` /
    // `publishedRevision` likewise track save/publish round-trips
    // so the projection follows real server state, not the loader
    // snapshot frozen at mount.
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

  // Visibility-side projection of the post lifecycle. Sits next to
  // `sidebarRevisionSummary` (for the no-saved-revision hint) inside
  // 发布状态 — together they replace the two competing badges that
  // used to live on the toolbar's first row and inside 基本信息. We compute it here from the shell-owned
  // `meta` + the loader-supplied `detail` so the sidebar stays a
  // pure-props view.
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
    // `meta.publishedAt` is the user-facing input string (`YYYY-MM-DDTHH:mm`).
    // Treat unparsable / empty as "live now"; future = scheduled.
    const ts = meta.publishedAt === '' ? Number.NaN : Date.parse(meta.publishedAt)
    const isFuture = !Number.isNaN(ts) && ts > Date.now()
    if (isFuture) {
      return 'scheduled'
    }
    return publishState.kind === 'draft-ahead' ? 'live-with-draft-ahead' : 'live'
  }, [isEditing, publishState, meta.publishedAt])

  // Cmd/Ctrl-S = 保存草稿 (create-flow on create-mode posts);
  // Cmd/Ctrl+Shift+P = 发布草稿. Both shortcuts mirror the
  // toolbar's enabled state — a publish with no draft ahead is a
  // no-op so the shortcut bails before round-tripping. The
  // visibility toggles (取消发布 / 重新上线) intentionally have
  // no shortcut because they're rare destructive ops and we don't
  // want a slipped Cmd+Shift+P to accidentally take a live post
  // offline.
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
        // Mirror the toolbar's `canPublish` gate so a stuck
        // `published-current` post can't fire a no-op publish via
        // the shortcut.
        if (publishState.kind !== 'published-current') {
          persistPublish()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, isEditing, persistCreate, persistSave, persistPublish, publishState])

  // Editor-surface gate (title / body / meta sidebar). We use
  // `isSubmitting` rather than `isPending` here so the inputs
  // unfreeze the moment the network round-trip settles — the
  // trailing `loading` phase is React Router revalidating route
  // loaders, which can take seconds on a heavy detail loader and
  // is perfectly safe to overlap with continued editing. The
  // toolbar buttons (保存草稿 / 发布草稿 / 取消发布) keep using
  // this same flag, which is what we want: they're rate-limited
  // by the actual server round-trip, not by the lingering
  // revalidation, so a second click is allowed once the first
  // request has actually been answered.
  const isSubmittingAny =
    upsertMetaApi.isSubmitting || saveDraftApi.isSubmitting || publishApi.isSubmitting || unpublishApi.isSubmitting
  const isPending = isSubmittingAny || isCreatingPost
  // Per-button spinner flags. 保存草稿 fans out to meta + body, so
  // it spins while either leg is travelling; 发布草稿 / 取消发布
  // each track only their own fetcher. We deliberately do NOT
  // reflect autosave round-trips here — autosave is silent by
  // contract, the user shouldn't see the publish button briefly
  // spin because their last keystroke triggered a debounced
  // background draft.
  const isSavingDraft = upsertMetaApi.isSubmitting || saveDraftApi.isSubmitting
  const isPublishing = publishApi.isSubmitting
  const isUnpublishing = unpublishApi.isSubmitting

  // --- Conflict resolution handlers -----------------------------------------
  const adoptLocalDraft = useCallback(async () => {
    if (conflict === null || !isEditing) {
      return
    }
    // 1. Adopt the local body in the editor immediately so the user
    //    sees the right content even if the server save is slow.
    setBody(conflict.localBody)
    setBodyKey(`${detail.post.id}:adopt-local:${Date.now()}`)
    setConflict(null)
    setConflictResolved(true)
    // 2. Push the adopted body to the server with `force: true` so
    //    the server overwrites whatever it had as the latest draft.
    //    This burns the LS/server divergence in one round trip — the
    //    next opening of the post sees a single canonical revision.
    setStatus({ kind: 'saving' })
    const envelope = await submitApiAction<SavePostBodyInput, SavePostBodyOutput>(SAVE_DRAFT, {
      id: detail.post.id,
      body: conflict.localBody,
      expectedClientRevisionToken: expectedToken,
      force: true,
    })
    if ('data' in envelope && envelope.data !== undefined) {
      handleBodySavedRef.current(envelope.data)
    } else if ('error' in envelope && envelope.error !== undefined) {
      setStatus({ kind: 'error', message: envelope.error.message })
    }
  }, [conflict, isEditing, detail, expectedToken])

  const adoptServerVersion = useCallback(() => {
    setBody(initialBody)
    setBodyKey(`${detail?.post.id ?? 'new'}:adopt-server:${Date.now()}`)
    lastSavedBodyRef.current = initialBody
    clearDraft()
    setConflict(null)
    setConflictResolved(true)
  }, [initialBody, detail, clearDraft])

  // Pull a historical revision's body into the editor pane. We do
  // NOT call the server here — the operator still has to hit
  // 保存 / 发布 to persist the adopted body, the same way they
  // would after manually editing. This keeps "selecting a history
  // entry" reversible: closing the tab without saving discards the
  // adoption and the live post stays on whatever the published
  // revision was.
  const adoptRevisionFromHistory = useCallback(
    (revision: { body: PortableTextBody; revisionNo: number }) => {
      if (!isEditing) {
        return
      }
      setBody(revision.body)
      setBodyKey(`${detail.post.id}:adopt-revision:${revision.revisionNo}:${Date.now()}`)
      // Surface a hint so the operator notices the editor was
      // rewound — easy to miss otherwise because the body just
      // appears to "change" in the panel.
      setStatus({ kind: 'info', message: `已载入 R${revision.revisionNo}，记得保存或发布以生效。` })
    },
    [isEditing, detail],
  )

  // Title is the only mandatory field at this layer. Slug is optional —
  // the server falls back to `deriveSlug(title)` (pinyin-pro ->
  // github-slugger) when blank, so the editor doesn't have to ship a
  // 150KB pinyin table just to preview the auto-derived value.
  const canPersistMeta = meta.title.trim() !== ''
  // The publish button is suppressed when the latest revision *is*
  // already the published one (publishing again would create an
  // empty no-op revision). The user can still re-publish by making
  // any edit (which moves to `draft-ahead`) or by hitting 取消发布
  // first and 发布 again.
  const canPublish = isEditing && publishState.kind !== 'published-current'

  // Project the shell-owned `PublishState` (which mixes visibility +
  // revision lifecycle into one tagged union) into the
  // visibility-free `SidebarRevisionSummary` the sidebar consumes.
  // Derived here alongside `sidebarPublishStatus`; `RevisionSummaryInline`
  // only surfaces 「当前还没有保存的版本」 when applicable — revision
  // numbers stay off the 基本信息 card (badges carry lifecycle state).
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

  return (
    <div className={cn('flex flex-col gap-4 p-4', previewOpen ? 'min-h-0 flex-1' : 'min-h-[calc(100vh-4rem)]')}>
      {/* Toolbar splits into two intent groups that share a single row
       *  when there is room:
       *    LEFT  — navigation away (`返回列表`, `公开预览`)
       *    RIGHT — work on the current document (`实时预览`, action
       *            buttons, `元数据`)
       *  Labels collapse to icons in two tiers as the viewport
       *  narrows: LEFT first (`<lg`), RIGHT second (`<sm`). That way
       *  the destructive / publish controls keep their text labels for
       *  longer than the navigation chrome — operators are less likely
       *  to mis-tap an unfamiliar icon on a destructive action.
       *  `flex-wrap` keeps the meta button reachable when the editing
       *  state surfaces five RIGHT buttons (实时预览 / 保存 / 发布 /
       *  取消发布 / 元数据): on iPhone-class widths even the all-icon
       *  collapse exceeds the viewport, so the right group wraps to a
       *  second row instead of being pushed off-screen. */}
      <header className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link to="/wp-admin/posts">
                <ArrowLeftIcon />
                <span className="sr-only lg:not-sr-only">返回列表</span>
              </Link>
            }
          />
          {isEditing ? (
            <Button
              variant="ghost"
              size="sm"
              render={
                <Link to={`/${detail.post.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon />
                  <span className="sr-only lg:not-sr-only">公开预览</span>
                </Link>
              }
            />
          ) : null}
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <Button
            variant={previewOpen ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPreviewOpen((open) => !open)}
            title={previewOpen ? '关闭实时预览，恢复菜单' : '开启实时预览，并折叠左侧菜单'}
            aria-pressed={previewOpen}
            className={cn(previewOpen && 'border border-transparent')}
          >
            {previewOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
            <span className="sr-only sm:not-sr-only">实时预览</span>
          </Button>
          {mode === 'create' ? (
            <Button
              size="sm"
              onClick={() => {
                void persistCreate()
              }}
              disabled={isPending || !canPersistMeta}
              title="保存文章信息并上传当前正文"
            >
              {isCreatingPost ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
              <span className="sr-only sm:not-sr-only">{isCreatingPost ? '创建中…' : '创建文章'}</span>
            </Button>
          ) : (
            <>
              {/* Two-step authoring affordance: 保存草稿 always pushes
               *  meta + body-as-draft, 发布草稿 promotes the latest
               *  draft to published. Splitting them means the operator
               *  can iterate on a live post (each save becomes a new
               *  draft revision) without touching what visitors see,
               *  and only commits when they explicitly publish. */}
              <Button
                variant="outline"
                size="sm"
                onClick={persistSave}
                disabled={isPending || !canPersistMeta}
                title="保存文章信息（立即生效），并在正文与最新版本不一致时另存为新草稿 (Cmd/Ctrl+S)"
              >
                {isSavingDraft ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
                <span className="sr-only sm:not-sr-only">{isSavingDraft ? '保存中…' : '保存草稿'}</span>
              </Button>
              <Button
                size="sm"
                onClick={persistPublish}
                disabled={isPending || !canPublish}
                title={
                  canPublish
                    ? sidebarPublishStatus === 'scheduled'
                      ? '将最新草稿按计划时间上线 (Cmd/Ctrl+Shift+P)'
                      : '将最新草稿发布到线上 (Cmd/Ctrl+Shift+P)'
                    : '当前没有待发布的草稿'
                }
              >
                {isPublishing ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
                <span className="sr-only sm:not-sr-only">
                  {isPublishing ? '发布中…' : sidebarPublishStatus === 'scheduled' ? '计划发布' : '发布草稿'}
                </span>
              </Button>
              {/* Visibility toggle. Only surfaces when the post is
               *  currently live (`meta.published === true`). An offline
               *  or never-published post reaches public visibility
               *  exclusively through 发布草稿 — there's no separate
               *  「重新上线」 affordance. */}
              {meta.published ? (
                <Button
                  variant="destructive-soft"
                  size="sm"
                  onClick={persistUnpublish}
                  disabled={isPending}
                  title="将文章下线，公开访问会返回 404；正文不会丢失，再次发布草稿即可恢复"
                >
                  {isUnpublishing ? <Loader2Icon className="animate-spin" /> : <EyeOffIcon />}
                  <span className="sr-only sm:not-sr-only">{isUnpublishing ? '取消中…' : '取消发布'}</span>
                </Button>
              ) : null}
            </>
          )}
          <Button
            variant={metaOpen ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setMetaOpen((open) => !open)}
            title={metaOpen ? '隐藏文章信息面板' : '展开文章信息面板'}
            aria-pressed={metaOpen}
            aria-label="切换文章信息面板"
            className={cn(metaOpen && 'border border-transparent')}
          >
            <SlidersHorizontalIcon />
            <span className="sr-only sm:not-sr-only">元数据</span>
          </Button>
        </div>
      </header>

      {isEditing && previewBanner !== null ? (
        <PostActionBanner kind={previewBanner.kind} slug={previewBanner.slug} onClose={dismissPreviewBanner} />
      ) : null}

      {/* Layout grid. Three states drive the column template, picked
       *  to give every visible pane a usable width without forcing
       *  the operator to scroll horizontally:
       *    - preview off + meta open  → [editor | meta]      (2 col)
       *    - preview off + meta hidden → [editor]              (1 col)
       *    - preview on               → [editor | preview]    (2 col)
       *      meta is moved into a `Sheet` overlay so the third
       *      column doesn't squeeze the editor and preview to ~33%
       *      each on 13" laptops.
       *  The Sheet renders on every viewport when `previewOpen`, so
       *  the answer to "metadata is unreachable when previewing" is
       *  always one click on the toolbar's 元数据 button. */}
      <div
        className={cn(
          'grid min-h-0 gap-4',
          previewOpen ? 'flex-1' : 'grow',
          !previewOpen && metaOpen && 'lg:grid-cols-[minmax(0,1fr)_360px]',
          !previewOpen && !metaOpen && 'lg:grid-cols-[minmax(0,1fr)]',
          previewOpen && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          {mode === 'create' ? <CreateModeBanner draftSavedAt={createDraft.loadedDraft?.savedAt ?? null} /> : null}
          {/* Title + slug strip is suppressed in live-preview mode.
           *  The editor canvas then begins with the body's first
           *  block, lining up with the preview pane's mirrored
           *  title row on the right; the operator edits the title
           *  and slug from the floating 文章信息 sheet (or from
           *  the basic-info card inline) instead. */}
          {!previewOpen ? (
            <TitleSlugStrip
              title={meta.title}
              slug={meta.slug}
              onTitleChange={(value) => setMeta((m) => ({ ...m, title: value }))}
              onSlugChange={(value) => setMeta((m) => ({ ...m, slug: value }))}
              disabled={isPending}
            />
          ) : null}
          <PageBodyEditor
            initialBody={initialBody}
            bodyKey={bodyKey}
            onBodyChange={setBody}
            disabled={isPending}
            livePreviewOpen={previewOpen}
            scrollContainerRef={editorScrollRef}
            floatingActions={
              isEditing ? (
                <FloatingPublishButton
                  onPublish={persistPublish}
                  disabled={isPending || !canPublish}
                  pending={isPublishing}
                  title={
                    canPublish
                      ? sidebarPublishStatus === 'scheduled'
                        ? '将最新草稿按计划时间上线 (Cmd/Ctrl+Shift+P)'
                        : '将最新草稿发布到线上 (Cmd/Ctrl+Shift+P)'
                      : '当前没有待发布的草稿'
                  }
                />
              ) : null
            }
          />
        </div>
        {previewOpen ? (
          <section aria-label="实时预览" className="flex min-h-0 min-w-0 flex-1 flex-col">
            <PreviewPane
              body={body}
              title={meta.title}
              slug={meta.slug}
              showPublicSyncHint={showPreviewPublicSyncHint}
              scrollContainerRef={previewScrollRef}
            />
          </section>
        ) : null}
        {/* Inline metadata rail. Only renders in the 2-column
         *  `[editor | meta]` layout at `lg+` viewports — preview mode
         *  hands the panel off to the Sheet below so the editor +
         *  preview keep full width, and small tablets / phones do the
         *  same so the editor never gets squeezed below the third
         *  column. The `hidden lg:flex` belt-and-braces guarantees
         *  the aside never paints below the editor on narrow
         *  viewports, even before the post-hydration `isLg` effect
         *  has corrected `metaOpen`. */}
        {!previewOpen && metaOpen ? (
          <aside className="hidden min-h-0 flex-col overflow-y-auto pr-1 lg:flex">
            <PostMetaSidebar
              draft={meta}
              onChange={setMeta}
              disabled={isPending}
              publishStatus={sidebarPublishStatus}
              ogPreviewSlug={isEditing ? detail.post.slug : null}
              revisionSummary={sidebarRevisionSummary}
              saveStatus={sidebarSaveStatus}
              featureEnabled={featureEnabled}
              extras={
                isEditing ? (
                  <div className="rounded-md border bg-card p-2">
                    <RevisionHistoryDrawer
                      type="post"
                      ownerId={detail.post.id}
                      currentToken={expectedToken}
                      currentBody={body}
                      onAdoptRevision={adoptRevisionFromHistory}
                    />
                  </div>
                ) : null
              }
            />
          </aside>
        ) : null}
      </div>
      {/* Floating metadata sheet — the panel is identical to the
       *  inline `<aside>` above (same `PostMetaSidebar` props) so the
       *  operator's mental model doesn't shift when previewing. We
       *  render the Sheet markup whenever the layout would otherwise
       *  have nowhere to put the inline aside: live preview (which
       *  takes the third column) OR a `<lg` viewport (where there
       *  simply is no third column). Open/close transition still
       *  animates via `metaOpen`. */}
      {previewOpen || !isLg ? (
        <Sheet open={metaOpen} onOpenChange={setMetaOpen}>
          <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
            <SheetHeader className="border-b">
              <SheetTitle>文章信息</SheetTitle>
              <SheetDescription>编辑标题、Slug、SEO、发布时间等元数据。</SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              <PostMetaSidebar
                draft={meta}
                onChange={setMeta}
                disabled={isPending}
                publishStatus={sidebarPublishStatus}
                ogPreviewSlug={isEditing ? detail.post.slug : null}
                revisionSummary={sidebarRevisionSummary}
                saveStatus={sidebarSaveStatus}
                featureEnabled={featureEnabled}
                extras={
                  isEditing ? (
                    <div className="rounded-md border bg-card p-2">
                      <RevisionHistoryDrawer
                        type="post"
                        ownerId={detail.post.id}
                        currentToken={expectedToken}
                        currentBody={body}
                        onAdoptRevision={adoptRevisionFromHistory}
                      />
                    </div>
                  ) : null
                }
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
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
          onChooseLocal={() => {
            void adoptLocalDraft()
          }}
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
  unpublishApi: { isPending: boolean }
}

function isPendingForAutosave({ upsertMetaApi, saveDraftApi, publishApi, unpublishApi }: AutosavePendingArg): boolean {
  return upsertMetaApi.isPending || saveDraftApi.isPending || publishApi.isPending || unpublishApi.isPending
}

interface PostActionBannerProps {
  kind: 'draft' | 'published'
  slug: string
  onClose: () => void
}

// Persistent banner shown after a manual 保存草稿 / 发布草稿
// succeeds. Two cosmetic variants share the same shape:
//   - 'draft'     — amber theme, points at the admin-only
//                   `?draft=true` overlay URL.
//   - 'published' — green theme, points at the public URL.
// Persistence is intentional: the operator may want to copy / open
// the link multiple times before moving on. Closing is fully
// manual via the trailing button; a follow-up successful action
// replaces the banner in place. We don't auto-hide on a timer to
// avoid the link disappearing mid-action — autosave / further
// edits don't toggle it either.
function PostActionBanner({ kind, slug, onClose }: PostActionBannerProps) {
  const href = kind === 'draft' ? `/${slug}?draft=true` : `/${slug}`
  const message =
    kind === 'draft'
      ? '草稿已保存，可通过下方链接预览最新内容（仅管理员可见草稿）：'
      : '草稿已发布，可通过下方链接访问最新内容：'
  const themeClass =
    kind === 'draft'
      ? 'border-status-warn-border/30 bg-status-warn-bg text-status-warn-fg dark:bg-status-warn-bg dark:text-status-warn-fg'
      : 'border-status-success-border/30 bg-status-success-bg text-status-success-fg dark:bg-status-success-bg dark:text-status-success-fg'
  const closeBtnClass =
    kind === 'draft'
      ? 'text-status-warn-fg/80 hover:bg-status-warn-border/20 hover:text-status-warn-fg dark:text-status-warn-fg/80 dark:hover:text-status-warn-fg'
      : 'text-status-success-fg/80 hover:bg-status-success-border/20 hover:text-status-success-fg dark:text-status-success-fg/80 dark:hover:text-status-success-fg'
  return (
    <div
      role="status"
      className={cn('flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs', themeClass)}
    >
      <span>{message}</span>
      <Link to={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono underline">
        <ExternalLinkIcon className="size-3" />
        {href}
      </Link>
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭提示"
        title="关闭提示"
        className={cn('ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5', closeBtnClass)}
      >
        <XIcon className="size-3.5" />
        <span>关闭</span>
      </button>
    </div>
  )
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
    <div className="flex items-center justify-between rounded-md border border-destructive/10 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
      <span>新文章正文仅本地保留，点击「创建文章」后才会同步到服务器。</span>
      {draftSavedAt !== null ? (
        <span className="font-mono">已恢复本地草稿 · {new Date(draftSavedAt).toLocaleTimeString('zh-CN')}</span>
      ) : null}
    </div>
  )
}

interface TitleSlugStripProps {
  title: string
  slug: string
  onTitleChange: (value: string) => void
  onSlugChange: (value: string) => void
  disabled?: boolean
}

// Title + slug strip rendered immediately above the body editor,
// mirroring the layout in CMSes like Notion / Ghost / WordPress's
// block editor: the visible post identity sits at the top of the
// canvas, not buried in a side panel. The values are mirrored into
// `meta` (the `PostMetaSidebar` form state), so editing here updates
// the metadata draft the same way the sidebar does — the next
// 保存 / 创建文章 / 重新上线 click pushes both fields to the
// server. The sidebar's URL slug input still works as a secondary
// surface for operators who land in 文章信息 first.
function TitleSlugStrip({ title, slug, onTitleChange, onSlugChange, disabled }: TitleSlugStripProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card p-3">
      <Input
        aria-label="文章标题"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="文章标题"
        maxLength={200}
        disabled={disabled}
        className="h-auto border-0 bg-transparent px-0 text-2xl leading-tight font-bold tracking-tight shadow-none focus-visible:ring-0 md:text-3xl dark:bg-transparent"
      />
      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <span>/</span>
        <Input
          aria-label="URL slug"
          value={slug}
          onChange={(e) => onSlugChange(e.target.value)}
          placeholder="留空将根据标题按拼音生成"
          maxLength={80}
          disabled={disabled}
          className="h-7 grow border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
    </div>
  )
}

type PublishState =
  // No revision has been promoted yet. Saving still works; the post
  // is invisible to the public until a manual 发布.
  | { kind: 'not-published-yet' }
  // Latest revision was promoted AND `meta.published === true` —
  // post is live with the current body.
  | { kind: 'published-current'; revisionNo: number }
  // Latest is a draft sitting on top of a (possibly missing)
  // published revision. Visible publicly iff `meta.published`.
  | { kind: 'draft-ahead'; draftRevisionNo: number; publishedRevisionNo: number | null }
  // A revision was promoted at some point but the operator later
  // hit 取消发布. The body still exists in `content`; flipping
  // `meta.published` back to true re-shows the post.
  | { kind: 'unpublished'; lastPublishedRevisionNo: number | null }

function derivePublishState(
  latest: AdminRevisionDto | null,
  published: AdminRevisionDto | null,
  visible: boolean,
): PublishState {
  if (latest === null) {
    // No revisions at all — the "尚未发布" badge is correct
    // regardless of `meta.published` (an empty post can't be
    // public anyway).
    return { kind: 'not-published-yet' }
  }

  if (!visible) {
    // Operator explicitly took the post offline. We still know the
    // last revision number that *was* live so the badge can hint
    // at it.
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
