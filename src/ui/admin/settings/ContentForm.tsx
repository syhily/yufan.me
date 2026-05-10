import type { ContentSettings } from '@/shared/blog-config'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsCheckboxRow, SettingsRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
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
  postSortBy: 'publishedAt' | 'updatedAt'
  postFeatureEnabled: boolean
  footnotesSectionTitle: string
}

const SORT_DIR_ITEMS = [
  { value: 'desc', label: '最新优先（desc）' },
  { value: 'asc', label: '最旧优先（asc）' },
]

const SORT_BY_ITEMS = [
  { value: 'publishedAt', label: '首次发布时间' },
  { value: 'updatedAt', label: '最近更新时间' },
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
      postSortBy: source.post.sortBy,
      postFeatureEnabled: source.post.featureEnabled ?? false,
      footnotesSectionTitle: source.footnotes?.sectionTitle ?? '尾声礼记',
    }),
    fromState: (state) => {
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
          sortBy: state.postSortBy,
          featureEnabled: state.postFeatureEnabled,
        },
        footnotes: { sectionTitle: state.footnotesSectionTitle.trim() || '尾声礼记' },
      }
    },
  })

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
        description="文章列表的默认排序方向。开启置顶后，可在文章编辑页将文章置顶到首页精选区。"
      >
        <SettingsRow label="排序字段" htmlFor="content-post-sort-by">
          <Select
            value={draft.postSortBy}
            items={SORT_BY_ITEMS}
            onValueChange={(value) =>
              setDraft((prev) => ({ ...prev, postSortBy: (value ?? 'publishedAt') as 'publishedAt' | 'updatedAt' }))
            }
          >
            <SelectTrigger id="content-post-sort-by" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_BY_ITEMS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label="排序方向" htmlFor="content-post-sort">
          <Select
            value={draft.postSort}
            items={SORT_DIR_ITEMS}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, postSort: (value ?? 'desc') as 'asc' | 'desc' }))}
          >
            <SelectTrigger id="content-post-sort" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_DIR_ITEMS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsCheckboxRow
          id="content-post-feature-enabled"
          rowLabel="开启置顶功能"
          checkboxLabel="首页展示置顶文章"
          hint="关闭后首页不展示精选文章，文章编辑页也不显示置顶开关。"
          checked={draft.postFeatureEnabled}
          onCheckedChange={(value) => setDraft((prev) => ({ ...prev, postFeatureEnabled: value }))}
        />
      </SettingsSection>

      <SettingsSection
        title="脚注汇总标题"
        description="Portable Text 页面文末脚注列表上方的标题，默认为「尾声礼记」。不影响 MDX 文章页的脚注样式。"
      >
        <SettingsRow label="标题文案" htmlFor="content-footnotes-section-title">
          <Input
            id="content-footnotes-section-title"
            type="text"
            maxLength={120}
            value={draft.footnotesSectionTitle}
            onChange={(e) => setDraft((prev) => ({ ...prev, footnotesSectionTitle: e.target.value }))}
            required
          />
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
