import type { PortableTextBody as PortableTextBodyType } from '@/shared/pt/schema'

import { prerenderToHtml } from '@/server/render/react-prerender'
import { requireBlogSettingsBundle, requireBlogSettingsSection } from '@/shared/config/blog'
import { resolveFootnotesSectionTitle } from '@/shared/utils/footnotes-section-title'
import { BlogSettingsProvider } from '@/ui/lib/blog-config-context'
import { PortableTextBody } from '@/ui/pt/render'

export interface RenderPortableTextToHtmlOptions {
  rssMode?: boolean
  suppressMusicAutoplay?: boolean
}

export async function renderPortableTextToHtml(
  body: PortableTextBodyType,
  headingSlugs: readonly string[],
  options: RenderPortableTextToHtmlOptions = {},
): Promise<string> {
  const bundle = requireBlogSettingsBundle()
  const footnotesSectionTitle = resolveFootnotesSectionTitle(requireBlogSettingsSection('content'))
  return prerenderToHtml(
    <BlogSettingsProvider value={bundle}>
      <PortableTextBody
        body={body}
        headingSlugs={headingSlugs}
        footnotesSectionTitle={footnotesSectionTitle}
        rssMode={options.rssMode}
        suppressMusicAutoplay={options.suppressMusicAutoplay}
      />
    </BlogSettingsProvider>,
  )
}
