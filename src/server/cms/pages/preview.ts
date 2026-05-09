import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { PortableTextBody } from '@/shared/portable-text'

import { deriveSlug } from '@/server/slug'
import { collectHeadings } from '@/shared/portable-text'
import { PortableTextBody as PortableTextBodyComponent } from '@/ui/portable-text/PortableTextBody'

// Render the supplied PortableText body to a stand-alone HTML fragment
// for the editor's right-pane preview.
//
// Delegates to the shared `<PortableTextBody>` SSR renderer so the
// preview matches the public detail route byte-for-byte. Heading
// anchor ids are derived through the canonical pinyin slug pipeline
// so the preview's `<h1 id="...">` matches what the published page
// would emit.
//
// Note: the friends grid (`page.show_friends` meta toggle) is not
// part of the body, so it is intentionally excluded from this
// preview — what the operator sees here is exactly what the body
// renders, no chrome.
export async function renderPortableTextToHtml(body: PortableTextBody): Promise<string> {
  const headingSlugs = collectHeadings(body, deriveSlug).map((h) => h.slug)
  const element = createElement(PortableTextBodyComponent, { body, headingSlugs })
  return renderToStaticMarkup(element)
}
