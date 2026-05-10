import type { ReactElement } from 'react'

import { text } from 'node:stream/consumers'
import { prerenderToNodeStream } from 'react-dom/static'

// Streaming prerender drain used by the RSS/Atom feed renderer (feeds need
// an HTML string body per item). Post/page detail routes no longer go
// through this helper — they render the PortableText body directly inside
// the React tree via `@/ui/portable-text/PortableTextBody`. Image
// enhancement at runtime for feeds is handled by `enhanceImageHtml`.
export async function prerenderToHtml(element: ReactElement): Promise<string> {
  const { prelude } = await prerenderToNodeStream(element)
  return text(prelude)
}
