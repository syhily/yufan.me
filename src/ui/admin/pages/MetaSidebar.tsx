import { ImageIcon, XIcon } from 'lucide-react'

import type { AdminPageDto } from '@/shared/cms-pages'
import type { AdminImageDto } from '@/shared/images'

import { ImageLibraryPicker } from '@/ui/admin/pages/ImageLibraryPicker'
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
    // Trim seconds + timezone for `<input type="datetime-local">`.
    // The DTO carries an ISO-8601 string; the input wants "YYYY-MM-DDTHH:mm".
    publishedAt: isoToLocalInputValue(page.publishedAt),
  }
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

export interface MetaSidebarProps {
  draft: PageMetaDraft
  onChange: (next: PageMetaDraft) => void
  /** Disable every input while a save / publish is in flight. */
  disabled?: boolean
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
export function MetaSidebar({ draft, onChange, disabled, extras }: MetaSidebarProps) {
  const set = <K extends keyof PageMetaDraft>(key: K, value: PageMetaDraft[K]) => onChange({ ...draft, [key]: value })

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
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
            id="page-published"
            label="已发布"
            description="未发布的页面在公网会返回 404，仅自己可预览。"
            checked={draft.published}
            onCheckedChange={(value) => set('published', value)}
            disabled={disabled}
          />
          <div className="grid gap-2">
            <Label htmlFor="page-published-at">发布时间</Label>
            <Input
              id="page-published-at"
              type="datetime-local"
              value={draft.publishedAt}
              onChange={(e) => set('publishedAt', e.target.value)}
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              留空保持现有时间。修改后会更新页面对外展示的发布日期，并影响排序。
            </p>
          </div>
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
