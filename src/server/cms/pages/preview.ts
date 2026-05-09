import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { PortableTextBody } from '@/shared/portable-text'

import { deriveSlug } from '@/server/slug'
import { collectHeadings } from '@/shared/portable-text'
import { PortableTextBody as PortableTextBodyComponent } from '@/ui/portable-text/PortableTextBody'

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
  const element = createElement(PortableTextBodyComponent, { body, headingSlugs, suppressMusicAutoplay: true })
  return renderToStaticMarkup(element)
}
