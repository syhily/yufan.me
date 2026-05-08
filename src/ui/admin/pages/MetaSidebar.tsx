import { CalendarClockIcon, CheckCircle2Icon, CircleDashedIcon, EyeOffIcon, ImageIcon, XIcon } from 'lucide-react'
import { useId } from 'react'

import type { AdminPageDto } from '@/shared/cms-pages'
import type { AdminImageDto } from '@/shared/images'

import { ImageLibraryPicker } from '@/ui/admin/pages/ImageLibraryPicker'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Checkbox } from '@/ui/components/ui/checkbox'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Textarea } from '@/ui/components/ui/textarea'

// Editable subset of `AdminPageDto`. The body is owned by the editor
// pane separately, so this state is purely metadata.
export interface PageMetaDraft {
  slug: string
  title: string
  summary: string
  cover: string
  og: string
  published: boolean
  commentsEnabled: boolean
  showToc: boolean
  /**
   * `<input type="datetime-local">` value (no timezone). Kept as a
   * raw string so the sidebar doesn't have to round-trip through the
   * Date constructor on every keystroke. Empty string ⇒ "leave the
   * current `publishedAt` alone on save".
   */
  publishedAt: string
}

export const EMPTY_META_DRAFT: PageMetaDraft = {
  slug: '',
  title: '',
  summary: '',
  cover: '',
  og: '',
  published: true,
  commentsEnabled: true,
  showToc: false,
  publishedAt: '',
}

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

// High-level "where is this page in its lifecycle?" used to render
// the badge inside the 基本信息 card. The shell derives the value
// from server state + `meta.published` + `meta.publishedAt` and
// hands it in; the sidebar stays free of any business logic.
export type SidebarPublishStatus =
  // No revisions exist yet (create mode or a doc that's never been
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
   * Optional extra slot rendered at the bottom of the panel. Used by
   * the editor shell to mount the revision history drawer trigger
   * once a page has been saved (creating mode renders nothing).
   */
  extras?: React.ReactNode
}

// Right-pane metadata panel for the page editor. Lives in its own
// component so the editor route can swap the right pane between this
// (default) and a live preview without re-mounting the editor.
export function MetaSidebar({ draft, onChange, disabled, publishStatus, extras }: MetaSidebarProps) {
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
            publishedAt={draft.publishedAt}
            onChangePublishedAt={(value) => set('publishedAt', value)}
            disabled={disabled}
          />
          <div className="grid gap-2">
            <Label htmlFor="page-title">标题</Label>
            <Input
              id="page-title"
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="关于我"
              maxLength={200}
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="page-slug">URL slug</Label>
            <Input
              id="page-slug"
              value={draft.slug}
              onChange={(e) => set('slug', e.target.value)}
              placeholder="about"
              maxLength={80}
              disabled={disabled}
            />
            <p className="font-mono text-xs text-muted-foreground">/{draft.slug || 'slug'}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="page-summary">摘要</Label>
            <Textarea
              id="page-summary"
              value={draft.summary}
              onChange={(e) => set('summary', e.target.value)}
              rows={3}
              maxLength={500}
              disabled={disabled}
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
            两项均为可选。封面用于列表与文章顶部展示；OG 图供社交平台分享卡片使用，留空则回退到封面。
          </p>
          <ImageField
            id="page-cover"
            label="封面图"
            placeholder="https://… 或从图片库挑选"
            value={draft.cover}
            onChange={(value) => set('cover', value)}
            disabled={disabled}
          />
          <ImageField
            id="page-og"
            label="OG 图"
            placeholder="留空则使用封面图"
            value={draft.og}
            onChange={(value) => set('og', value)}
            disabled={disabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">展示选项</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <ToggleRow
            id="page-comments"
            label="开启评论"
            description="关闭后页面底部不再渲染评论区。"
            checked={draft.commentsEnabled}
            onCheckedChange={(value) => set('commentsEnabled', value)}
            disabled={disabled}
          />
          <ToggleRow
            id="page-toc"
            label="显示目录"
            description="启用后右侧会渲染基于二级标题的 TOC。"
            checked={draft.showToc}
            onCheckedChange={(value) => set('showToc', value)}
            disabled={disabled}
          />
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
  placeholder: string
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}

// Combined "URL input + library picker + thumbnail preview + clear"
// affordance for the cover / OG image fields. Storing a plain URL
// keeps the existing wire shape (`AdminPageDto.cover`/`og` are
// strings) and lets operators paste in CDN-hosted assets that
// aren't tracked in the image library.
function ImageField({ id, label, placeholder, value, onChange, disabled }: ImageFieldProps) {
  const handlePick = (image: AdminImageDto) => onChange(image.publicUrl)

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label} <span className="text-xs font-normal text-muted-foreground">（可选）</span>
        </Label>
        <div className="flex items-center gap-1">
          <ImageLibraryPicker
            trigger={
              <Button variant="outline" size="sm" type="button" disabled={disabled}>
                <ImageIcon /> 从图片库选择
              </Button>
            }
            onPick={handlePick}
          />
          {value !== '' ? (
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
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={500}
        disabled={disabled}
      />
      {value !== '' ? (
        <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-2">
          <img
            src={value}
            alt={`${label} 预览`}
            loading="lazy"
            decoding="async"
            className="size-16 shrink-0 rounded object-cover"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
            }}
          />
          <p className="grow truncate font-mono text-xs text-muted-foreground" title={value}>
            {value}
          </p>
        </div>
      ) : null}
    </div>
  )
}

interface PublishStatusRowProps {
  status: SidebarPublishStatus
  /** Current `<input type="datetime-local">` value (`''` = unset). */
  publishedAt: string
  onChangePublishedAt: (value: string) => void
  disabled?: boolean
}

// "Publish status + publish time" widget shown at the top of 基本信息.
//
// The status badge tells the operator where the page sits in its
// lifecycle ("尚未保存" / "已下线" / "已计划" / "已发布" / "草稿
// 领先"). The publish-time radio toggles between two presets:
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
function PublishStatusRow({ status, publishedAt, onChangePublishedAt, disabled }: PublishStatusRowProps) {
  const fieldId = useId()
  const isScheduled = publishedAt !== ''
  const isFuture = isScheduled && (Date.parse(publishedAt) || 0) > Date.now()

  return (
    <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">发布状态</Label>
        <PublishBadge status={status} isFuture={isFuture} />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">发布时间</Label>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name={`${fieldId}-mode`}
              checked={!isScheduled}
              onChange={() => onChangePublishedAt('')}
              disabled={disabled}
            />
            立即发布
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name={`${fieldId}-mode`}
              checked={isScheduled}
              onChange={() => {
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
            />
            定时发布
          </label>
        </div>
        {isScheduled ? (
          <Input
            id={`${fieldId}-at`}
            type="datetime-local"
            value={publishedAt}
            onChange={(e) => onChangePublishedAt(e.target.value)}
            disabled={disabled}
          />
        ) : null}
        <p className="text-xs text-muted-foreground">
          {isScheduled
            ? isFuture
              ? '点击「发布」会按上述时间上线，到时间前公网会返回 404。'
              : '已选择的时间不在未来，点击「发布」会立刻上线。'
            : '点击「发布」会立刻上线，并使用当前时间作为对外展示的发布日期。'}
        </p>
      </div>
    </div>
  )
}

function PublishBadge({ status, isFuture }: { status: SidebarPublishStatus; isFuture: boolean }) {
  switch (status) {
    case 'never-saved':
      return (
        <Badge variant="outline">
          <CircleDashedIcon /> 尚未保存
        </Badge>
      )
    case 'offline':
      return (
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          <EyeOffIcon /> 已取消发布
        </Badge>
      )
    case 'scheduled':
      return (
        <Badge variant="secondary">
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
        <Badge>
          <CheckCircle2Icon /> 已发布
        </Badge>
      )
    case 'live-with-draft-ahead':
      return (
        <Badge variant="secondary">
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
