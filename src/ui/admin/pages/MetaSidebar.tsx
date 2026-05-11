import {
  CalendarClockIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  EyeOffIcon,
  ImagePlusIcon,
  LinkIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

import type { AdminPageDto, PageMetaDraft } from '@/shared/cms-pages'
import type { AdminImageDto } from '@/shared/images'

import { EMPTY_PAGE_META_DRAFT, PAGE_META_TOGGLE_FIELDS, pageMetaDraftsEqual } from '@/shared/cms-pages'
import { ImageLibraryPicker } from '@/ui/admin/editor/pickers/ImageLibraryPicker'
import { DateTimePicker } from '@/ui/admin/pages/DateTimePicker'
import { Badge } from '@/ui/components/badge'
import { Button } from '@/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card'
import { Checkbox } from '@/ui/components/checkbox'
import { Input } from '@/ui/components/input'
import { Label } from '@/ui/components/label'
import { RadioGroup, RadioGroupItem } from '@/ui/components/radio-group'
import { Textarea } from '@/ui/components/textarea'
import { cn } from '@/ui/lib/cn'

export type { PageMetaDraft } from '@/shared/cms-pages'
export const EMPTY_META_DRAFT = EMPTY_PAGE_META_DRAFT
export const metaDraftsEqual = pageMetaDraftsEqual

export function metaDraftFromPage(page: AdminPageDto): PageMetaDraft {
  return {
    slug: page.slug,
    title: page.title,
    summary: page.summary,
    cover: page.cover,
    og: page.og ?? '',
    published: page.published,
    commentsEnabled: page.commentsEnabled,
    showToc: page.showToc,
    showUpdated: page.showUpdated,
    showFriends: page.showFriends,
    // The picker treats the non-empty datetime-local string as "the
    // operator has opted into 定时发布 mode". For an already-published
    // page sitting in the past, leaving the string non-empty would
    // misleadingly start the editor in "schedule mode" with a past
    // time. Default-blank the field when the stored timestamp is at
    // or before "now" so the sidebar opens in 立即发布 mode (matching
    // the wire convention: empty ⇒ omit on publish ⇒ server stamps
    // `now()`). Future timestamps surface verbatim so the operator
    // can edit / cancel a pending schedule.
    publishedAt: futureLocalInputValueOrEmpty(page.publishedAt),
  }
}

function futureLocalInputValueOrEmpty(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms) || ms <= Date.now()) {
    return ''
  }
  return isoToLocalInputValue(iso)
}

/**
 * Convert an ISO-8601 wire DTO timestamp into the `YYYY-MM-DDTHH:mm`
 * shape that `<input type="datetime-local">` expects. Returns `''`
 * for invalid inputs so the picker just renders blank.
 */
function isoToLocalInputValue(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) {
    return ''
  }
  const d = new Date(ms)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Inverse of `isoToLocalInputValue`. Returns `null` for empty input
 * so the caller can omit `publishedAt` from the save payload (server
 * preserves the existing value in that case).
 */
export function localInputValueToIso(value: string): string | null {
  if (value.trim() === '') {
    return null
  }
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) {
    return null
  }
  return new Date(ms).toISOString()
}

/**
 * Revision-side projection of where the page sits in its versioning
 * lifecycle. Built by the editor shell from `detail.latestRevision` /
 * `detail.publishedRevision` and threaded into the sidebar so the
 * 发布状态 card can surface 「当前还没有保存的版本」 when applicable,
 * without the sidebar reaching back into server DTOs. Independent of
 * `SidebarPublishStatus` — that one tracks visibility (offline /
 * scheduled / live), this one tracks the draft↔published version
 * relationship.
 */
export type SidebarRevisionSummary =
  | { kind: 'no-revision' }
  // Latest committed revision *is* the currently-promoted one — no
  // newer draft sitting on top.
  | { kind: 'published-current'; revisionNo: number }
  // A draft revision is ahead of the (possibly missing) published
  // revision. Carried for shell-side derivations; not shown inline.
  | { kind: 'draft-ahead'; draftRevisionNo: number; publishedRevisionNo: number | null }

// High-level "where is this page in its lifecycle?" used to render
// the badge inside the 基本信息 card. The shell derives the value
// from server state + `meta.published` + `meta.publishedAt` and
// hands it in; the sidebar stays free of any business logic.
/** Right-rail save-state line — derived in `PageEditorShell`, rendered under 发布状态. */
export type SidebarSaveStatus =
  | { kind: 'unsaved' }
  | { kind: 'saving' }
  | { kind: 'saved'; atMs: number }
  | { kind: 'error'; message: string }
  | { kind: 'conflict' }
  | { kind: 'info'; message: string }

export type SidebarPublishStatus =
  // No revisions exist yet (create mode or a page that's never been
  // saved to the server).
  | 'never-saved'
  // Latest revision exists but the page is offline (`published =
  // false`). May or may not have been live in the past.
  | 'offline'
  // `published = true` and `publishedAt > now()`. The catalog
  // hides the page until the timestamp arrives.
  | 'scheduled'
  // `published = true` and `publishedAt <= now()` and the latest
  // revision has been promoted.
  | 'live'
  // `published = true` and `publishedAt <= now()` but the latest
  // revision is a draft sitting on top of an older published row.
  | 'live-with-draft-ahead'

export interface MetaSidebarProps {
  draft: PageMetaDraft
  onChange: (next: PageMetaDraft) => void
  /** Disable every input while a save / publish is in flight. */
  disabled?: boolean
  /**
   * Lifecycle status used to render the badge inside 基本信息.
   * `null` means the sidebar is being rendered in a context that
   * doesn't have a clear publish state (create mode before first
   * save), and the badge falls back to `never-saved`.
   */
  publishStatus?: SidebarPublishStatus | null
  /**
   * Persisted slug of the page being edited, used to render the
   * generated `/images/og/:slug.png` preview when the OG override is
   * empty. We deliberately read the *server-side* slug rather than
   * `draft.slug` so the preview keeps pointing at a working URL even
   * while the operator is mid-typing a new slug — the preview tile
   * would 404 on every keystroke otherwise. `null` (create mode or
   * before first save) collapses the OG empty-state into a static
   * placeholder explaining "save first to preview".
   */
  ogPreviewSlug?: string | null
  /**
   * Revision-versioning summary rendered alongside the visibility
   * badge inside 发布状态. `null` or `no-revision` renders as
   * 「当前还没有保存的版本」 inline; other kinds omit extra copy (the
   * badge already reflects draft vs live). The shell owns
   * the projection because it has direct access to
   * `detail.latestRevision` / `publishedRevision`; the sidebar is
   * pure-props.
   */
  revisionSummary?: SidebarRevisionSummary | null
  /** Shell-derived draft / persist lifecycle for the 保存状态 row under 发布状态. */
  saveStatus: SidebarSaveStatus
  /**
   * Optional extra slot rendered at the bottom of the panel. Used by
   * the editor shell to mount the revision history drawer trigger
   * once a page has been saved (creating mode renders nothing).
   */
  extras?: ReactNode
}

// Right-pane metadata panel for the page editor. Lives in its own
// component so the editor route can swap the right pane between this
// (default) and a live preview without re-mounting the editor.
export function MetaSidebar({
  draft,
  onChange,
  disabled,
  publishStatus,
  ogPreviewSlug,
  revisionSummary,
  saveStatus,
  extras,
}: MetaSidebarProps) {
  const set = <K extends keyof PageMetaDraft>(key: K, value: PageMetaDraft[K]) => onChange({ ...draft, [key]: value })

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <PublishStatusRow
            status={publishStatus ?? 'never-saved'}
            revisionSummary={revisionSummary ?? null}
            saveStatus={saveStatus}
            publishedAt={draft.publishedAt}
            onChangePublishedAt={(value) => set('publishedAt', value)}
            disabled={disabled}
          />
          <div className="grid gap-2">
            <Label htmlFor="page-summary">摘要</Label>
            <Textarea
              id="page-summary"
              value={draft.summary}
              onChange={(e) => set('summary', e.target.value)}
              rows={3}
              maxLength={500}
              disabled={disabled}
              placeholder="可选，用于列表与社交分享卡片。"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">封面 / OG 图</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-xs text-muted-foreground">
            两项均为可选。封面用于列表与文章顶部展示；OG 图供社交平台分享卡片使用，留空则回退到默认生成的 OG 卡片。
          </p>
          <ImageField
            id="page-cover"
            label="封面图"
            value={draft.cover}
            onChange={(value) => set('cover', value)}
            disabled={disabled}
            aspect="aspect-[16/9]"
            urlPlaceholder="https://… 或从图片库挑选"
            emptyHint="点击此处上传封面，或粘贴一张图片 URL。"
          />
          <ImageField
            id="page-og"
            label="OG 图"
            value={draft.og}
            onChange={(value) => set('og', value)}
            disabled={disabled}
            aspect="aspect-[1200/630]"
            urlPlaceholder="留空则使用默认生成的 OG"
            emptyContent={
              ogPreviewSlug !== null && ogPreviewSlug !== undefined && ogPreviewSlug !== '' ? (
                <GeneratedOgPreview
                  slug={ogPreviewSlug}
                  cover={draft.cover}
                  title={draft.title}
                  summary={draft.summary}
                />
              ) : undefined
            }
            emptyHint={
              ogPreviewSlug !== null && ogPreviewSlug !== undefined && ogPreviewSlug !== ''
                ? '当前展示的是默认生成的 OG。点击图片可上传一张专属 OG 覆盖。'
                : '页面首次保存后，这里会展示默认生成的 OG 预览。也可现在点击上传一张专属 OG。'
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">展示选项</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {PAGE_META_TOGGLE_FIELDS.map((field) => (
            <ToggleRow
              key={field.key}
              id={field.id}
              label={field.label}
              description={field.description}
              checked={draft[field.key]}
              onCheckedChange={(value) => set(field.key, value)}
              disabled={disabled}
            />
          ))}
        </CardContent>
      </Card>
      {extras !== undefined ? extras : null}
    </div>
  )
}

interface ToggleRowProps {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (next: boolean) => void
  disabled?: boolean
}

interface ImageFieldProps {
  id: string
  label: string
  /** Current override URL. Empty string ⇒ "use default / unset". */
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  /**
   * Tailwind aspect class controlling the click-target shape. Cover
   * fields use `aspect-[16/9]` (the list-card preview shape); OG
   * fields use `aspect-[1200/630]` (the default OG render dimensions
   * declared in `setting('blog.seo')`). Hard-coding the aspect at
   * the call site keeps every preview tile pixel-perfect for its
   * downstream surface.
   */
  aspect: string
  /** Placeholder shown inside the collapsed "粘贴 URL" `<input>`. */
  urlPlaceholder: string
  /**
   * Optional empty-state surface rendered *inside* the click target
   * when `value === ''`. The OG field uses this to drop the live
   * `<GeneratedOgPreview />` underneath the click overlay so the
   * operator sees the auto-generated OG card and can click anywhere
   * on it to override. When omitted, the empty-state shows a
   * plus-icon placeholder.
   */
  emptyContent?: ReactNode
  /**
   * One-line hint rendered below the click target. Cover and OG use
   * this to explain the click affordance and (for OG) to clarify
   * whether the displayed preview is a generated default or the
   * operator's override.
   */
  emptyHint?: string
}

// Image-first metadata field: the entire aspect-ratio'd surface is a
// click target that opens the library picker. Storing a plain URL
// keeps the existing wire shape (`AdminPageDto.cover`/`og` are
// strings) and lets operators paste a CDN-hosted asset that isn't
// tracked in the image library by toggling the "粘贴 URL" affordance
// in the header.
//
// State machine:
//   1. `value !== ''`         → render the override image, full bleed.
//                                Header shows 替换 / 清空; clicking the
//                                image surface opens the picker.
//   2. `value === ''` + `emptyContent` provided → render `emptyContent`
//                                 (the generated-OG preview, in our
//                                 OG case) under a transparent click
//                                 overlay; header shows 替换 only.
//   3. `value === ''` + no `emptyContent` → dashed placeholder with a
//                                 plus icon; entire surface clicks
//                                 through to the picker.
function ImageField({
  id,
  label,
  value,
  onChange,
  disabled,
  aspect,
  urlPlaceholder,
  emptyContent,
  emptyHint,
}: ImageFieldProps) {
  const [showUrl, setShowUrl] = useState(false)
  const handlePick = (image: AdminImageDto) => onChange(image.publicUrl)
  const hasValue = value !== ''

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>
          {label} <span className="text-xs font-normal text-muted-foreground">（可选）</span>
        </Label>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            title={showUrl ? '收起 URL 输入' : '粘贴 URL'}
            aria-label={showUrl ? `收起 ${label} 的 URL 输入` : `粘贴 ${label} 的 URL`}
            aria-pressed={showUrl}
            onClick={() => setShowUrl((prev) => !prev)}
            disabled={disabled}
          >
            <LinkIcon />
          </Button>
          {hasValue ? (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              title="清空"
              aria-label={`清空 ${label}`}
              onClick={() => onChange('')}
              disabled={disabled}
            >
              <XIcon />
            </Button>
          ) : null}
        </div>
      </div>
      <ImageLibraryPicker
        trigger={
          <button
            type="button"
            disabled={disabled}
            aria-label={hasValue ? `替换 ${label}` : `选择 ${label}`}
            className={cn(
              'group relative block w-full overflow-hidden rounded-md border bg-muted/30',
              aspect,
              'transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
              disabled
                ? 'cursor-not-allowed opacity-60'
                : 'cursor-pointer hover:border-primary hover:ring-2 hover:ring-primary/30',
            )}
          >
            {hasValue ? (
              <img
                src={value}
                alt={`${label} 预览`}
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                }}
              />
            ) : emptyContent !== undefined ? (
              emptyContent
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImagePlusIcon className="size-6" />
                <span className="text-xs">点击选择 / 上传</span>
              </span>
            )}
            <span
              className={cn(
                'pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white opacity-0 transition',
                'group-hover:opacity-100 group-focus-visible:opacity-100',
              )}
            >
              {hasValue ? '点击替换' : '点击选择'}
            </span>
          </button>
        }
        onPick={handlePick}
      />
      {!hasValue && emptyHint !== undefined ? <p className="text-xs text-muted-foreground">{emptyHint}</p> : null}
      {showUrl ? (
        <Input
          id={`${id}-url`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={urlPlaceholder}
          maxLength={500}
          disabled={disabled}
        />
      ) : hasValue ? (
        <p className="truncate font-mono text-xs text-muted-foreground" title={value}>
          {value}
        </p>
      ) : null}
    </div>
  )
}

interface GeneratedOgPreviewProps {
  /** Persisted slug of the page (the URL slot of `/images/og/:slug.png`). */
  slug: string
  /** Editor-side cover URL — folded into the cache-buster so the preview refreshes when the operator swaps covers. */
  cover: string
  /** Editor-side title — folded into the cache-buster for the same reason as `cover`. */
  title: string
  /** Editor-side summary — same reason. */
  summary: string
}

// Live preview of the auto-generated OG card. Rendered inside the
// OG `ImageField`'s empty-state slot. The image source includes a
// `?_=<short-hash>` cache-buster derived from the editor draft so a
// title / summary / cover change in the metadata pane forces the
// browser to fetch the freshly-generated OG instead of reusing the
// previous tile (the server-side cache already keys on the same
// inputs via `ogCacheKey`, so this just bypasses the browser's
// memory cache, not the Redis layer).
function GeneratedOgPreview({ slug, cover, title, summary }: GeneratedOgPreviewProps) {
  const buster = djb2Short(`${title}\u0001${summary}\u0001${cover}`)
  const src = `/images/og/${encodeURIComponent(slug)}.png?_=${buster}`
  return (
    <>
      <img
        src={src}
        alt="默认生成的 OG 预览"
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
        }}
      />
      <Badge variant="secondary" className="pointer-events-none absolute top-1.5 left-1.5 gap-1">
        <SparklesIcon className="size-3" /> 默认生成
      </Badge>
    </>
  )
}

// Tiny non-cryptographic hash used purely as a per-input browser
// cache buster for the generated OG preview. We deliberately avoid
// importing a crypto helper here because the value is never compared
// against anything server-side — collisions only cause a missed
// preview refresh, which the operator can fix by re-clicking the
// image. djb2 is constant-memory, ~20 LOC, and produces 8 hex chars
// which is plenty of entropy for a debounce-grade buster.
function djb2Short(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 8)
}

function formatSavedAtLocal(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function SaveStatusLine({ status }: { status: SidebarSaveStatus }) {
  switch (status.kind) {
    case 'unsaved':
      return <span className="text-xs text-muted-foreground">未保存</span>
    case 'saving':
      return <span className="text-xs text-muted-foreground">保存中…</span>
    case 'saved':
      return <span className="text-xs text-muted-foreground">{formatSavedAtLocal(status.atMs)}</span>
    case 'error':
      return <span className="text-xs text-destructive">{status.message}</span>
    case 'conflict':
      return <span className="text-xs text-destructive">检测到云端有更新的修订，请刷新后再保存。</span>
    case 'info':
      return <span className="text-xs text-amber-600 dark:text-amber-400">{status.message}</span>
  }
}

interface PublishStatusRowProps {
  status: SidebarPublishStatus
  revisionSummary: SidebarRevisionSummary | null
  saveStatus: SidebarSaveStatus
  /** Current `<input type="datetime-local">` value (`''` = unset). */
  publishedAt: string
  onChangePublishedAt: (value: string) => void
  disabled?: boolean
}

// "Publish status + publish time" widget shown at the top of 基本信息.
//
// The status badge tells the operator where the page sits in its
// lifecycle ("尚未保存" / "已下线" / "已计划" / "已发布" /
// "已发布（有未发布草稿）"). The publish-time radio toggles between two presets:
//
//   - 立即发布 — `publishedAt` is cleared. The publish action
//     reads "no override" and the server stamps `now()`. (For an
//     already-published page this means "leave the existing
//     timestamp alone"; the publish flow on the editor toolbar
//     re-stamps `now()` if the operator hits 发布 again.)
//
//   - 定时发布 — exposes a `<input type="datetime-local">` so the
//     operator can pick a future time. Sending that to 发布 parks
//     the page as "scheduled" — the public site 404s it until the
//     timestamp arrives.
function PublishStatusRow({
  status,
  revisionSummary,
  saveStatus,
  publishedAt,
  onChangePublishedAt,
  disabled,
}: PublishStatusRowProps) {
  const fieldId = useId()
  const isScheduled = publishedAt !== ''
  const isFuture = isScheduled && (Date.parse(publishedAt) || 0) > Date.now()

  return (
    <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
      <div className="grid gap-1">
        <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">发布状态</Label>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <PublishBadge status={status} isFuture={isFuture} />
          <RevisionSummaryInline summary={revisionSummary} />
        </div>
      </div>
      <div className="grid gap-1 border-t border-border/60 pt-3">
        <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">保存状态</Label>
        <SaveStatusLine status={saveStatus} />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">发布时间</Label>
        <RadioGroup
          value={isScheduled ? 'scheduled' : 'now'}
          onValueChange={(next) => {
            if (next === 'now') {
              onChangePublishedAt('')
              return
            }
            if (isScheduled) {
              return
            }
            // Default to "tomorrow at 09:00 local" when the
            // operator first switches into schedule mode, so
            // the picker isn't fighting with the "now" they
            // just opted out of.
            const d = new Date()
            d.setDate(d.getDate() + 1)
            d.setHours(9, 0, 0, 0)
            onChangePublishedAt(dateToLocalInputValue(d))
          }}
          disabled={disabled}
          className="grid-cols-2 gap-2"
        >
          <PublishModeOption
            id={`${fieldId}-now`}
            value="now"
            active={!isScheduled}
            label="立即发布"
            description="使用当前时间"
          />
          <PublishModeOption
            id={`${fieldId}-scheduled`}
            value="scheduled"
            active={isScheduled}
            label="定时发布"
            description="到点上线"
          />
        </RadioGroup>
        {isScheduled ? (
          <DateTimePicker id={`${fieldId}-at`} value={publishedAt} onChange={onChangePublishedAt} disabled={disabled} />
        ) : null}
        <p className="text-xs text-muted-foreground">
          {isScheduled
            ? isFuture
              ? '点击「发布草稿」会按上述时间上线，到时间前公网会返回 404。'
              : '已选择的时间不在未来，点击「发布草稿」会立刻上线。'
            : '点击「发布草稿」会立刻上线，并使用当前时间作为对外展示的发布日期。'}
        </p>
      </div>
    </div>
  )
}

function RevisionSummaryInline({ summary }: { summary: SidebarRevisionSummary | null }) {
  if (summary === null || summary.kind === 'no-revision') {
    return <span className="text-xs text-muted-foreground">当前还没有保存的版本</span>
  }
  return null
}

interface PublishModeOptionProps {
  id: string
  value: string
  active: boolean
  label: string
  description: string
}

function PublishModeOption({ id, value, active, label, description }: PublishModeOptionProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-2 rounded-md border bg-background p-2 transition-colors',
        active ? 'border-primary ring-1 ring-primary/30' : 'hover:bg-accent/40',
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <div className="grid gap-0.5 text-sm leading-tight">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    </label>
  )
}

function PublishBadge({ status, isFuture }: { status: SidebarPublishStatus; isFuture: boolean }) {
  switch (status) {
    case 'never-saved':
      return (
        <Badge
          variant="outline"
          className="border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200"
        >
          <CircleDashedIcon /> 尚未保存
        </Badge>
      )
    case 'offline':
      return (
        <Badge
          variant="outline"
          className="border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100"
        >
          <EyeOffIcon /> 已取消发布
        </Badge>
      )
    case 'scheduled':
      return (
        <Badge
          variant="outline"
          className="border-sky-400 bg-sky-50 text-sky-950 dark:border-sky-600 dark:bg-sky-950/55 dark:text-sky-100"
        >
          <CalendarClockIcon /> 已计划发布
        </Badge>
      )
    case 'live':
      // The picker may show "立即发布" while the server is already
      // live; the badge stays "已发布". When the operator switches
      // to a future time the badge alone wouldn't reflect that yet
      // (it only flips on save). Keep it deterministic so the
      // header doesn't flicker as the operator toys with the
      // picker.
      void isFuture
      return (
        <Badge
          variant="outline"
          className="border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-100"
        >
          <CheckCircle2Icon /> 已发布
        </Badge>
      )
    case 'live-with-draft-ahead':
      return (
        <Badge
          variant="outline"
          className="border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/45 dark:text-amber-100"
        >
          <CheckCircle2Icon /> 已发布（有未发布草稿）
        </Badge>
      )
  }
}

// Helper used by the schedule-mode radio to drop the operator
// straight into "tomorrow 09:00" — sharing the same `YYYY-
// MM-DDTHH:mm` shape the picker reads from `draft.publishedAt`.
function dateToLocalInputValue(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ToggleRow({ id, label, description, checked, onCheckedChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        disabled={disabled}
      />
      <div className="grid gap-1 text-sm">
        <label htmlFor={id} className="font-medium select-none">
          {label}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
