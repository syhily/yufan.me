import type { PortableTextBody } from '@/shared/pt/schema'

import { deriveSlug } from '@/server/infra/slug'
import { renderPortableTextToHtml as renderPortableTextBodyToHtml } from '@/server/present/feed/feed-pt-render'
import { collectHeadings } from '@/shared/pt/schema'

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
  return renderPortableTextBodyToHtml(body, headingSlugs, { suppressMusicAutoplay: true })
}
