import { previewPageBodySchema } from '@/server/cms/pages/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { deriveSlug } from '@/server/slug'
import { collectHeadings } from '@/shared/pt/schema'

// Render the supplied body to a stand-alone HTML fragment for the
// editor's right-pane preview. The body is validated by the schema
// (so the editor can never POST a malformed payload) and the
// headings are extracted server-side so the preview pane can render
// the same TOC the published page would.
//
// HTML rendering goes through the dedicated SSR PortableText renderer,
// imported lazily so this resource route doesn't pay the renderer's
// startup cost on cold boot when the editor isn't open.
// 1MB ceiling on the inbound PortableText body. PT bodies are JSON
// arrays of plain text + a sprinkle of metadata; even a 50K-word
// post stays well under 200KB. 1MB is comfortably above that and
// a hard stop against accidental runaway payloads.
const MAX_BODY_BYTES = 1 * 1024 * 1024

export const action = defineApiAction({
  method: 'POST',
  input: previewPageBodySchema,
  requireAdmin: true,
  maxBodyBytes: MAX_BODY_BYTES,
  async run({ payload }) {
    const { renderPortableTextToHtml } = await import('@/server/cms/pages/preview')
    const html = await renderPortableTextToHtml(payload.body)
    const headings = collectHeadings(payload.body, deriveSlug)
    return { html, headings }
  },
})
