import type { SeoSettings } from '@/shared/config/blog'

import { SettingsFormBar } from '@/ui/admin/settings/SettingsFormBar'
import { SettingsRow, SettingsSection } from '@/ui/admin/settings/SettingsSection'
import { useSettingsForm } from '@/ui/admin/settings/useSettingsForm'
import { Input } from '@/ui/components/input'

interface SeoFormProps {
  // Per-section DTO: matches `setting('blog.seo')`.
  seo: SeoSettings
}

interface FormState {
  twitter: string
  tocMin: number
  tocMax: number
  ogWidth: number
  ogHeight: number
}

export function SeoForm({ seo }: SeoFormProps) {
  const { draft, setDraft, isDirty, onSubmit, isPending, status, errorMessage, revert } = useSettingsForm<
    SeoSettings,
    FormState
  >({
    section: 'seo',
    source: seo,
    toState: (source) => ({
      twitter: source.twitter,
      tocMin: source.toc.minHeadingLevel,
      tocMax: source.toc.maxHeadingLevel,
      ogWidth: source.og.width,
      ogHeight: source.og.height,
    }),
    fromState: (state) => ({
      twitter: state.twitter.trim(),
      toc: { minHeadingLevel: state.tocMin, maxHeadingLevel: state.tocMax },
      og: { width: state.ogWidth, height: state.ogHeight },
    }),
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SettingsSection title="SEO" description="文章页 SEO meta 引用的字段。">
        <SettingsRow
          label="Twitter Handle"
          htmlFor="seo-twitter"
          hint="用于 twitter:site / twitter:creator meta；可省略前导 @。"
        >
          <Input
            id="seo-twitter"
            value={draft.twitter}
            onChange={(e) => setDraft((prev) => ({ ...prev, twitter: e.target.value }))}
            placeholder="syhily"
            maxLength={60}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="目录 (TOC)" description="文章右侧目录的标题层级范围。">
        <SettingsRow label="最浅级别" htmlFor="seo-toc-min" hint="只显示比这个级别更深的标题。1 表示包含 h1。">
          <Input
            id="seo-toc-min"
            type="number"
            min={1}
            max={6}
            value={draft.tocMin}
            onChange={(e) => setDraft((prev) => ({ ...prev, tocMin: Number.parseInt(e.target.value, 10) || 1 }))}
          />
        </SettingsRow>
        <SettingsRow label="最深级别" htmlFor="seo-toc-max" hint="超过该级别的标题不计入目录。">
          <Input
            id="seo-toc-max"
            type="number"
            min={1}
            max={6}
            value={draft.tocMax}
            onChange={(e) => setDraft((prev) => ({ ...prev, tocMax: Number.parseInt(e.target.value, 10) || 1 }))}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="OG 图渲染尺寸"
        description="服务端 Canvas 用以下尺寸生成 /images/og/:slug.png 并写入 og:image:width / og:image:height meta。修改后会立即影响新生成的图片，已缓存的图片需手动清理。"
      >
        <SettingsRow
          label="宽度 (px)"
          htmlFor="seo-og-width"
          hint="600–4096，建议 ≥1200 以满足 Twitter / Facebook 卡片清晰度。"
        >
          <Input
            id="seo-og-width"
            type="number"
            min={600}
            max={4096}
            value={draft.ogWidth}
            onChange={(e) => setDraft((prev) => ({ ...prev, ogWidth: Number.parseInt(e.target.value, 10) || 1200 }))}
          />
        </SettingsRow>
        <SettingsRow label="高度 (px)" htmlFor="seo-og-height" hint="315–4096，常见 1.91:1 比例对应 1200×630。">
          <Input
            id="seo-og-height"
            type="number"
            min={315}
            max={4096}
            value={draft.ogHeight}
            onChange={(e) => setDraft((prev) => ({ ...prev, ogHeight: Number.parseInt(e.target.value, 10) || 630 }))}
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
