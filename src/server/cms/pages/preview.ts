import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { PortableTextBody } from '@/shared/portable-text'

import { getCatalog } from '@/server/catalog'
import { PortableTextBody as PortableTextBodyComponent } from '@/ui/portable-text/PortableTextBody'

// Render the supplied PortableText body to a stand-alone HTML fragment
// for the editor's right-pane preview.
//
// Delegates to the shared `<PortableTextBody>` SSR renderer so the
// preview matches the public detail route byte-for-byte. Friends list
// is sourced from the in-process catalog so a `friends` block on the
// page renders the live list rather than a placeholder.
export async function renderPortableTextToHtml(body: PortableTextBody): Promise<string> {
  const catalog = await getCatalog()
  const element = createElement(PortableTextBodyComponent, { body, friends: catalog.friends })
  return renderToStaticMarkup(element)
}
