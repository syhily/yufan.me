import { Trash2Icon } from 'lucide-react'

import type { ContentSettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsCheckboxRow, SettingsRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select'

interface ContentFormProps {
  // Per-section DTO: matches `setting('blog.content')`.
  content: ContentSettings
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

export function ContentForm({ content }: ContentFormProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    ContentSettings,
    FormState
  >({
    section: 'content',
    source: content,
    toState: (source) => ({
      pagPosts: source.pagination.posts,
      pagCategory: source.pagination.category,
      pagTags: source.pagination.tags,
      pagSearch: source.pagination.search,
      feedFull: source.feed.full,
      feedSize: source.feed.size,
      postSort: source.post.sort,
      postFeature: [...(source.post.feature ?? [])],
    }),
    fromState: (state) => {
      const cleanedFeature = state.postFeature.map((value) => value.trim()).filter((value) => value.length > 0)
      return {
        pagination: {
          posts: state.pagPosts,
          category: state.pagCategory,
          tags: state.pagTags,
          search: state.pagSearch,
        },
        feed: { full: state.feedFull, size: state.feedSize },
        post: {
          sort: state.postSort,
          ...(cleanedFeature.length > 0 ? { feature: cleanedFeature } : {}),
        },
      }
    },
  })

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
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection
        title="分页"
        description="每个列表页显示多少篇文章。改动会立即影响首页 / 分类 / 标签 / 搜索结果。"
      >
        <SettingsRow label="首页每页文章数" htmlFor="content-pag-posts">
          <Input
            id="content-pag-posts"
            type="number"
            min={1}
            max={100}
            value={draft.pagPosts}
            onChange={(e) => setDraft((prev) => ({ ...prev, pagPosts: Number.parseInt(e.target.value, 10) || 1 }))}
            required
          />
        </SettingsRow>
        <SettingsRow label="分类页每页文章数" htmlFor="content-pag-category">
          <Input
            id="content-pag-category"
            type="number"
            min={1}
            max={100}
            value={draft.pagCategory}
            onChange={(e) => setDraft((prev) => ({ ...prev, pagCategory: Number.parseInt(e.target.value, 10) || 1 }))}
            required
          />
        </SettingsRow>
        <SettingsRow label="标签页每页文章数" htmlFor="content-pag-tags">
          <Input
            id="content-pag-tags"
            type="number"
            min={1}
            max={100}
            value={draft.pagTags}
            onChange={(e) => setDraft((prev) => ({ ...prev, pagTags: Number.parseInt(e.target.value, 10) || 1 }))}
            required
          />
        </SettingsRow>
        <SettingsRow label="搜索结果每页数" htmlFor="content-pag-search">
          <Input
            id="content-pag-search"
            type="number"
            min={1}
            max={100}
            value={draft.pagSearch}
            onChange={(e) => setDraft((prev) => ({ ...prev, pagSearch: Number.parseInt(e.target.value, 10) || 1 }))}
            required
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="RSS / Atom Feed" description="决定 /feed 与 /feed/atom 输出的条目数与是否包含正文。">
        <SettingsCheckboxRow
          id="content-feed-full"
          rowLabel="包含完整正文"
          checkboxLabel="输出完整正文"
          hint="关闭后只输出摘要 + 永久链接。订阅器中阅读体验更好但不利于离线阅读。"
          checked={draft.feedFull}
          onCheckedChange={(value) => setDraft((prev) => ({ ...prev, feedFull: value }))}
        />
        <SettingsRow label="Feed 条目数" htmlFor="content-feed-size">
          <Input
            id="content-feed-size"
            type="number"
            min={1}
            max={100}
            value={draft.feedSize}
            onChange={(e) => setDraft((prev) => ({ ...prev, feedSize: Number.parseInt(e.target.value, 10) || 1 }))}
            required
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="文章排序与置顶"
        description="文章列表的默认排序方向。`feature` 列表里的 slug 会出现在侧边栏推荐中。"
      >
        <SettingsRow label="排序方向" htmlFor="content-post-sort">
          <Select
            value={draft.postSort}
            items={SORT_ITEMS}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, postSort: (value ?? 'desc') as 'asc' | 'desc' }))}
          >
            <SelectTrigger id="content-post-sort" className="w-full">
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
        </SettingsRow>
        <SettingsRow label="精选文章 slug 列表" hint="按顺序在侧边栏「精选」区显示，最多 20 个。每行一个 slug。">
          <div className="flex flex-col gap-2">
            {draft.postFeature.map((slug, index) => (
              <div key={index} className="flex gap-2">
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
                  <Trash2Icon data-icon />
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
        </SettingsRow>
      </SettingsSection>

      <SettingsFormBar
        isPending={isPending}
        isDirty={isDirty}
        status={status}
        errorMessage={errorMessage}
        onRevert={revert}
      />
    </form>
  )
}
