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
} from 'lucide-react'
import { Link } from 'react-router'

import type { AdminPostDetailDto, AdminPostDto } from '@/shared/types/posts'

import { orpc } from '@/client/api/client'
import { useCreatePostDraft } from '@/client/hooks/use-create-post-draft'
import { usePostLocalDraft } from '@/client/hooks/use-post-local-draft'
import { ActionBanner } from '@/ui/admin/editor-shell/ActionBanner'
import { DraftConflictDialog } from '@/ui/admin/editor-shell/DraftConflictDialog'
import { FloatingPublishButton } from '@/ui/admin/editor-shell/FloatingPublishButton'
import { PreviewPane } from '@/ui/admin/editor-shell/PreviewPanel'
import { RevisionHistoryDrawer } from '@/ui/admin/editor-shell/RevisionsDrawer'
import { useEditorShellState } from '@/ui/admin/editor-shell/use-editor-shell-state'
import { PageBodyEditor } from '@/ui/admin/editor/PageBodyEditor'
import {
  EMPTY_POST_META_DRAFT,
  metaDraftFromPost,
  metaDraftsEqual,
  PostMetaSidebar,
  type PostMetaDraft,
} from '@/ui/admin/posts/PostMetaSidebar'
import { Button } from '@/ui/components/button'
import { Input } from '@/ui/components/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/components/sheet'
import { useContentSettings } from '@/ui/lib/blog-config-context'
import { cn } from '@/ui/lib/cn'

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

// Build the upsertMeta payload from a post meta draft. Post-specific
// fields (`pinnedAt`, `category`, `tags`, `alias`) sit on top of the
// common skeleton. `publishedAt` is omitted when `null` so the server
// preserves the persisted value.
function buildPostUpsertPayload({
  meta,
  id,
  publishedAt,
}: {
  meta: PostMetaDraft
  id?: string
  publishedAt: string | null
}): Record<string, unknown> {
  return {
    ...(id !== undefined ? { id } : {}),
    ...(meta.slug.trim() !== '' ? { slug: meta.slug.trim() } : {}),
    title: meta.title.trim(),
    summary: meta.summary.trim(),
    cover: meta.cover.trim(),
    og: meta.og.trim() === '' ? null : meta.og.trim(),
    commentsEnabled: meta.commentsEnabled,
    showToc: meta.showToc,
    showUpdated: meta.showUpdated,
    visible: meta.visible,
    pinnedAt: meta.pinned ? new Date().toISOString() : null,
    category: meta.category,
    tags: meta.tags,
    alias: meta.alias,
    ...(publishedAt !== null ? { publishedAt } : {}),
  }
}

// Top-level orchestrator for the post authoring screen. All shared
// state lives in `useEditorShellState`; this Shell wires the
// entity-specific mutations + LS hooks + sidebar component and
// renders the toolbar / layout / dialog markup.
export function PostEditorShell({ mode, detail, navigate }: PostEditorShellProps) {
  const contentSettings = useContentSettings()
  const featureEnabled = contentSettings.post.featureEnabled
  // Local narrowing flag so TS knows `detail` is defined in the
  // `isEditing` JSX branches below. `isEditing` is just a
  // `boolean` and can't carry the type guard.
  const isEditing = mode === 'edit' && detail !== undefined

  // --- Shared state hook ---------------------------------------------------
  // The hook owns `useMutation()` internally — Shell only provides
  // entity-specific mutation functions + the LS hook factories.
  const state = useEditorShellState<PostMetaDraft, AdminPostDto>({
    mode,
    entityKind: 'post',
    detail: detail
      ? {
          entity: detail.post,
          latestRevision: detail.latestRevision,
          publishedRevision: detail.publishedRevision,
        }
      : undefined,
    emptyMeta: EMPTY_POST_META_DRAFT,
    metaDraftFromEntity: metaDraftFromPost,
    metaDraftsEqual,
    useLocalDraftHook: ({ entityId, clientRevisionToken, body, disabled }) =>
      usePostLocalDraft({ postId: entityId, clientRevisionToken, body, disabled }),
    useCreateDraftHook: ({ body, meta }) => useCreatePostDraft({ body, meta }),
    upsertMetaFn: async (input) => {
      const result = await orpc.admin.posts.upsertMeta(input as never)
      return result.post
    },
    saveDraftFn: (input) => orpc.admin.posts.saveDraft(input as never),
    publishFn: (input) => orpc.admin.posts.publishLatest(input as never),
    unpublishFn: async (input) => {
      const result = await orpc.admin.posts.unpublish(input)
      return result.post
    },
    buildUpsertMetaPayload: buildPostUpsertPayload,
    directSaveDraft: (input) => orpc.admin.posts.saveDraft(input as never),
    editPath: (id) => `/admin/posts/${id}/edit`,
    navigate,
  })

  return (
    <div
      className={cn(
        'flex flex-col gap-0 p-0 md:gap-4 md:p-4',
        state.previewOpen ? 'min-h-0 flex-1' : 'min-h-[calc(100vh-4rem)]',
      )}
    >
      {/* Toolbar splits into two intent groups that share a single row
       *  when there is room:
       *    LEFT  — navigation away (`返回列表`, `公开预览`)
       *    RIGHT — work on the current document (`实时预览`, action
       *            buttons, `元数据`)
       *  Labels collapse to icons in two tiers as the viewport
       *  narrows: LEFT first (`<lg`), RIGHT second (`<sm`). */}
      <header className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link to="/admin/posts">
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
                <Link to={`/posts/${detail.post.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon />
                  <span className="sr-only lg:not-sr-only">公开预览</span>
                </Link>
              }
            />
          ) : null}
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <Button
            variant={state.previewOpen ? 'default' : 'outline'}
            size="sm"
            onClick={() => state.setPreviewOpen((open) => !open)}
            title={state.previewOpen ? '关闭实时预览，恢复菜单' : '开启实时预览，并折叠左侧菜单'}
            aria-pressed={state.previewOpen}
            className={cn('hidden lg:inline-flex', state.previewOpen && 'border border-transparent')}
          >
            {state.previewOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
            <span className="sr-only sm:not-sr-only">实时预览</span>
          </Button>
          {mode === 'create' ? (
            <Button
              size="sm"
              onClick={() => {
                void state.persistCreate()
              }}
              disabled={state.isPending || !state.canPersistMeta}
              title="保存文章信息并上传当前正文"
            >
              {state.isCreating ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
              <span className="sr-only sm:not-sr-only">{state.isCreating ? '创建中…' : '创建文章'}</span>
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={state.persistSave}
                disabled={state.isPending || !state.canPersistMeta}
                title="保存文章信息（立即生效），并在正文与最新版本不一致时另存为新草稿 (Cmd/Ctrl+S)"
              >
                {state.isSavingDraft ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
                <span className="sr-only sm:not-sr-only">{state.isSavingDraft ? '保存中…' : '保存草稿'}</span>
              </Button>
              <Button
                size="sm"
                onClick={state.persistPublish}
                disabled={state.isPending || !state.canPublish}
                title={
                  state.canPublish
                    ? state.sidebarPublishStatus === 'scheduled'
                      ? '将最新草稿按计划时间上线 (Cmd/Ctrl+Shift+P)'
                      : '将最新草稿发布到线上 (Cmd/Ctrl+Shift+P)'
                    : '当前没有待发布的草稿'
                }
              >
                {state.isPublishing ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
                <span className="sr-only sm:not-sr-only">
                  {state.isPublishing
                    ? '发布中…'
                    : state.sidebarPublishStatus === 'scheduled'
                      ? '计划发布'
                      : '发布草稿'}
                </span>
              </Button>
              {state.meta.published ? (
                <Button
                  variant="destructive-soft"
                  size="sm"
                  onClick={state.persistUnpublish}
                  disabled={state.isPending}
                  title="将文章下线，公开访问会返回 404；正文不会丢失，再次发布草稿即可恢复"
                >
                  {state.isUnpublishing ? <Loader2Icon className="animate-spin" /> : <EyeOffIcon />}
                  <span className="sr-only sm:not-sr-only">{state.isUnpublishing ? '取消中…' : '取消发布'}</span>
                </Button>
              ) : null}
            </>
          )}
          <Button
            variant={state.metaOpen ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => state.setMetaOpen((open) => !open)}
            title={state.metaOpen ? '隐藏文章信息面板' : '展开文章信息面板'}
            aria-pressed={state.metaOpen}
            aria-label="切换文章信息面板"
            className={cn(state.metaOpen && 'border border-transparent')}
          >
            <SlidersHorizontalIcon />
            <span className="sr-only sm:not-sr-only">元数据</span>
          </Button>
        </div>
      </header>

      {isEditing && state.previewBanner !== null ? (
        <ActionBanner
          kind={state.previewBanner.kind}
          slug={state.previewBanner.slug}
          basePath="/posts"
          onClose={state.dismissPreviewBanner}
        />
      ) : null}

      {/* Layout grid. Three states drive the column template:
       *    - preview off + meta open  → [editor | meta]      (2 col)
       *    - preview off + meta hidden → [editor]              (1 col)
       *    - preview on               → [editor | preview]    (2 col)
       *      meta is moved into a `Sheet` overlay. */}
      <div
        className={cn(
          'mt-4 grid min-h-0 gap-4 md:mt-0',
          state.previewOpen ? 'flex-1' : 'grow',
          !state.previewOpen && state.metaOpen && 'lg:grid-cols-[minmax(0,1fr)_360px]',
          !state.previewOpen && !state.metaOpen && 'lg:grid-cols-[minmax(0,1fr)]',
          state.previewOpen && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          {mode === 'create' ? <CreateModeBanner draftSavedAt={state.createDraftSavedAt} /> : null}
          {!state.previewOpen ? (
            <TitleSlugStrip
              title={state.meta.title}
              slug={state.meta.slug}
              onTitleChange={(value) => state.setMeta((m) => ({ ...m, title: value }))}
              onSlugChange={(value) => state.setMeta((m) => ({ ...m, slug: value }))}
              disabled={state.isPending}
            />
          ) : null}
          <PageBodyEditor
            initialBody={state.initialBody}
            bodyKey={state.bodyKey}
            onBodyChange={state.setBody}
            disabled={state.isPending}
            livePreviewOpen={state.previewOpen}
            scrollContainerRef={state.editorScrollRef}
            floatingActions={
              isEditing ? (
                <FloatingPublishButton
                  onPublish={state.persistPublish}
                  disabled={state.isPending || !state.canPublish}
                  pending={state.isPublishing}
                  title={
                    state.canPublish
                      ? state.sidebarPublishStatus === 'scheduled'
                        ? '将最新草稿按计划时间上线 (Cmd/Ctrl+Shift+P)'
                        : '将最新草稿发布到线上 (Cmd/Ctrl+Shift+P)'
                      : '当前没有待发布的草稿'
                  }
                />
              ) : null
            }
          />
        </div>
        {state.previewOpen ? (
          <section aria-label="实时预览" className="flex min-h-0 min-w-0 flex-1 flex-col">
            <PreviewPane
              body={state.body}
              title={state.meta.title}
              slug={state.meta.slug}
              showPublicSyncHint={state.showPreviewPublicSyncHint}
              scrollContainerRef={state.previewScrollRef}
            />
          </section>
        ) : null}
        {!state.previewOpen && state.metaOpen ? (
          <aside className="hidden min-h-0 flex-col overflow-y-auto pr-1 lg:flex">
            <PostMetaSidebar
              draft={state.meta}
              onChange={state.setMeta}
              disabled={state.isPending}
              publishStatus={state.sidebarPublishStatus}
              ogPreviewSlug={isEditing ? detail.post.slug : null}
              revisionSummary={state.sidebarRevisionSummary}
              saveStatus={state.sidebarSaveStatus}
              featureEnabled={featureEnabled}
              extras={
                isEditing ? (
                  <div className="rounded-md border bg-card p-2">
                    <RevisionHistoryDrawer
                      type="post"
                      ownerId={detail.post.id}
                      currentToken={state.expectedToken}
                      currentBody={state.body}
                      onAdoptRevision={state.adoptRevisionFromHistory}
                    />
                  </div>
                ) : null
              }
            />
          </aside>
        ) : null}
      </div>
      {state.previewOpen || !state.isLg ? (
        <Sheet open={state.metaOpen} onOpenChange={state.setMetaOpen}>
          <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
            <SheetHeader className="border-b">
              <SheetTitle>文章信息</SheetTitle>
              <SheetDescription>编辑标题、Slug、SEO、发布时间等元数据。</SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              <PostMetaSidebar
                draft={state.meta}
                onChange={state.setMeta}
                disabled={state.isPending}
                publishStatus={state.sidebarPublishStatus}
                ogPreviewSlug={isEditing ? detail.post.slug : null}
                revisionSummary={state.sidebarRevisionSummary}
                saveStatus={state.sidebarSaveStatus}
                featureEnabled={featureEnabled}
                extras={
                  isEditing ? (
                    <div className="rounded-md border bg-card p-2">
                      <RevisionHistoryDrawer
                        type="post"
                        ownerId={detail.post.id}
                        currentToken={state.expectedToken}
                        currentBody={state.body}
                        onAdoptRevision={state.adoptRevisionFromHistory}
                      />
                    </div>
                  ) : null
                }
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
      {state.conflict !== null && isEditing ? (
        <DraftConflictDialog
          open={true}
          localBody={state.conflict.localBody}
          serverBody={state.initialBody}
          localSavedAt={state.conflict.localSavedAt}
          serverUpdatedAt={
            (detail.latestRevision ?? detail.publishedRevision)?.updatedAt
              ? Date.parse((detail.latestRevision ?? detail.publishedRevision)!.updatedAt)
              : null
          }
          onChooseLocal={() => {
            void state.adoptLocalDraft()
          }}
          onChooseServer={state.adoptServerVersion}
        />
      ) : null}
    </div>
  )
}

interface CreateModeBannerProps {
  draftSavedAt: number | null
}

function CreateModeBanner({ draftSavedAt }: CreateModeBannerProps) {
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

// Title + slug strip rendered immediately above the body editor —
// the visible post identity sits at the top of the canvas, not buried
// in a side panel. Values mirror into `meta`; the next save click
// pushes both fields to the server.
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
