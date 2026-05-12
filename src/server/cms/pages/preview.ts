import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { PortableTextBody } from '@/shared/pt/schema'

import { deriveSlug } from '@/server/slug'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { resolveFootnotesSectionTitle } from '@/shared/footnotes-section-title'
import { collectHeadings } from '@/shared/pt/schema'
// Server→UI import exception: this file prerenders React components to
// static HTML for the admin editor preview pane. The UI module is only
// used during SSR and never reaches the client bundle.
import { PortableTextBody as PortableTextBodyComponent } from '@/ui/pt/render'

// Render the supplied PortableText body to a stand-alone HTML fragment
// for the editor's right-pane preview.
//
// Delegates to the shared `<PortableTextBody>` SSR renderer with
// `suppressMusicAutoplay` so preview HTML matches the live preview
// pane (no autoplay). Heading anchor ids use the canonical pinyin slug
// pipeline so `<h1 id="...">` matches the published page.
//
// Note: the friends grid (`page.show_friends` meta toggle) is not
// part of the body, so it is intentionally excluded from this
// preview — what the operator sees here is exactly what the body
// renders, no chrome.
export async function renderPortableTextToHtml(body: PortableTextBody): Promise<string> {
  const headingSlugs = collectHeadings(body, deriveSlug).map((h) => h.slug)
  const footnotesSectionTitle = resolveFootnotesSectionTitle(requireBlogSettingsSection('content'))
  const element = createElement(PortableTextBodyComponent, {
    body,
    headingSlugs,
    suppressMusicAutoplay: true,
    footnotesSectionTitle,
  })
  return renderToStaticMarkup(element)
}
