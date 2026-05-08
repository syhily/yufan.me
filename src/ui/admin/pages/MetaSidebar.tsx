import type { AdminPageDto } from '@/shared/cms-pages'

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
  }
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
          <div className="grid gap-2">
            <Label htmlFor="page-cover">封面图 URL</Label>
            <Input
              id="page-cover"
              value={draft.cover}
              onChange={(e) => set('cover', e.target.value)}
              placeholder="https://…"
              maxLength={500}
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="page-og">OG 图 URL（可选）</Label>
            <Input
              id="page-og"
              value={draft.og}
              onChange={(e) => set('og', e.target.value)}
              placeholder="留空则使用封面图"
              maxLength={500}
              disabled={disabled}
            />
          </div>
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
