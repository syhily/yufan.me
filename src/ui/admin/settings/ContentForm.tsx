import { Trash2Icon } from 'lucide-react'
import { type SubmitEventHandler, useCallback, useEffect, useState } from 'react'

import type { BlogSettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { FieldRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsFetcher } from '@/ui/admin/settings/useSettingsFetcher'
import { Button } from '@/ui/admin/shadcn/components/ui/button'
import { Checkbox } from '@/ui/admin/shadcn/components/ui/checkbox'
import { Input } from '@/ui/admin/shadcn/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/admin/shadcn/components/ui/select'

interface ContentFormProps {
  settings: BlogSettings
  csrfToken: string
}

interface FormState {
  pagPosts: number
  pagCategory: number
  pagTags: number
  pagSearch: number
  feedFull: boolean
  feedSize: number
  postSort: 'asc' | 'desc'
  postFeature: string[]
}

const SORT_ITEMS = [
  { value: 'desc', label: '最新优先（desc）' },
  { value: 'asc', label: '最旧优先（asc）' },
]

function snapshotFromSettings(settings: BlogSettings): FormState {
  return {
    pagPosts: settings.settings.pagination.posts,
    pagCategory: settings.settings.pagination.category,
    pagTags: settings.settings.pagination.tags,
    pagSearch: settings.settings.pagination.search,
    feedFull: settings.settings.feed.full,
    feedSize: settings.settings.feed.size,
    postSort: settings.settings.post.sort,
    postFeature: [...(settings.settings.post.feature ?? [])],
  }
}

function statesEqual(a: FormState, b: FormState): boolean {
  return (
    a.pagPosts === b.pagPosts &&
    a.pagCategory === b.pagCategory &&
    a.pagTags === b.pagTags &&
    a.pagSearch === b.pagSearch &&
    a.feedFull === b.feedFull &&
    a.feedSize === b.feedSize &&
    a.postSort === b.postSort &&
    a.postFeature.length === b.postFeature.length &&
    a.postFeature.every((value, index) => value === b.postFeature[index])
  )
}

export function ContentForm({ settings, csrfToken: _csrfToken }: ContentFormProps) {
  const [snapshot, setSnapshot] = useState<FormState>(() => snapshotFromSettings(settings))
  const [draft, setDraft] = useState<FormState>(snapshot)

  useEffect(() => {
    const fresh = snapshotFromSettings(settings)
    setSnapshot(fresh)
    setDraft(fresh)
  }, [settings])

  const isDirty = !statesEqual(draft, snapshot)
  const onSaved = useCallback(() => setSnapshot(draft), [draft])
  const { save, isPending, status, errorMessage } = useSettingsFetcher({
    section: 'content',
    onSaved,
  })

  const onSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    const cleanedFeature = draft.postFeature.map((value) => value.trim()).filter((value) => value.length > 0)
    save({
      pagination: {
        posts: draft.pagPosts,
        category: draft.pagCategory,
        tags: draft.pagTags,
        search: draft.pagSearch,
      },
      feed: { full: draft.feedFull, size: draft.feedSize },
      post: {
        sort: draft.postSort,
        ...(cleanedFeature.length > 0 ? { feature: cleanedFeature } : {}),
      },
    })
  }

  const updateFeature = (index: number, value: string) => {
    setDraft((prev) => {
      const next = [...prev.postFeature]
      next[index] = value
      return { ...prev, postFeature: next }
    })
  }
  const removeFeature = (index: number) => {
    setDraft((prev) => ({ ...prev, postFeature: prev.postFeature.filter((_, i) => i !== index) }))
  }
  const addFeature = () => setDraft((prev) => ({ ...prev, postFeature: [...prev.postFeature, ''] }))

  return (
    <form onSubmit={onSubmit} className="tw:flex tw:flex-col tw:gap-6">
      <SettingsSection
        title="分页"
        description="每个列表页显示多少篇文章。改动会立即影响首页 / 分类 / 标签 / 搜索结果。"
      >
        <FieldRow label="首页每页文章数" htmlFor="content-pag-posts">
          <Input
            id="content-pag-posts"
            type="number"
            min={1}
            max={100}
            value={draft.pagPosts}
            onChange={(e) => setDraft((prev) => ({ ...prev, pagPosts: Number.parseInt(e.target.value, 10) || 1 }))}
            required
          />
        </FieldRow>
        <FieldRow label="分类页每页文章数" htmlFor="content-pag-category">
          <Input
            id="content-pag-category"
            type="number"
            min={1}
            max={100}
            value={draft.pagCategory}
            onChange={(e) => setDraft((prev) => ({ ...prev, pagCategory: Number.parseInt(e.target.value, 10) || 1 }))}
            required
          />
        </FieldRow>
        <FieldRow label="标签页每页文章数" htmlFor="content-pag-tags">
          <Input
            id="content-pag-tags"
            type="number"
            min={1}
            max={100}
            value={draft.pagTags}
            onChange={(e) => setDraft((prev) => ({ ...prev, pagTags: Number.parseInt(e.target.value, 10) || 1 }))}
            required
          />
        </FieldRow>
        <FieldRow label="搜索结果每页数" htmlFor="content-pag-search">
          <Input
            id="content-pag-search"
            type="number"
            min={1}
            max={100}
            value={draft.pagSearch}
            onChange={(e) => setDraft((prev) => ({ ...prev, pagSearch: Number.parseInt(e.target.value, 10) || 1 }))}
            required
          />
        </FieldRow>
      </SettingsSection>

      <SettingsSection title="RSS / Atom Feed" description="决定 /feed 与 /feed/atom 输出的条目数与是否包含正文。">
        <FieldRow label="包含完整正文" hint="关闭后只输出摘要 + 永久链接。订阅器中阅读体验更好但不利于离线阅读。">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Checkbox
              id="content-feed-full"
              checked={draft.feedFull}
              onCheckedChange={(value) => setDraft((prev) => ({ ...prev, feedFull: value === true }))}
            />
            <label htmlFor="content-feed-full" className="tw:text-sm tw:select-none">
              输出完整正文
            </label>
          </div>
        </FieldRow>
        <FieldRow label="Feed 条目数" htmlFor="content-feed-size">
          <Input
            id="content-feed-size"
            type="number"
            min={1}
            max={100}
            value={draft.feedSize}
            onChange={(e) => setDraft((prev) => ({ ...prev, feedSize: Number.parseInt(e.target.value, 10) || 1 }))}
            required
          />
        </FieldRow>
      </SettingsSection>

      <SettingsSection
        title="文章排序与置顶"
        description="文章列表的默认排序方向。`feature` 列表里的 slug 会出现在侧边栏推荐中。"
      >
        <FieldRow label="排序方向" htmlFor="content-post-sort">
          <Select
            value={draft.postSort}
            items={SORT_ITEMS}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, postSort: (value ?? 'desc') as 'asc' | 'desc' }))}
          >
            <SelectTrigger id="content-post-sort" className="tw:w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_ITEMS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="精选文章 slug 列表" hint="按顺序在侧边栏「精选」区显示，最多 20 个。每行一个 slug。">
          <div className="tw:flex tw:flex-col tw:gap-2">
            {draft.postFeature.map((slug, index) => (
              <div key={index} className="tw:flex tw:gap-2">
                <Input
                  value={slug}
                  onChange={(e) => updateFeature(index, e.target.value)}
                  maxLength={200}
                  placeholder="post-slug"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="删除"
                  onClick={() => removeFeature(index)}
                >
                  <Trash2Icon className="tw:size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addFeature}
              disabled={draft.postFeature.length >= 20}
            >
              添加精选 slug
            </Button>
          </div>
        </FieldRow>
      </SettingsSection>

      <SettingsFormBar isPending={isPending} isDirty={isDirty} status={status} errorMessage={errorMessage} />
    </form>
  )
}
