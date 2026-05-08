import { previewPageBodySchema } from '@/server/cms/pages/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { collectHeadings } from '@/shared/portable-text'

// Render the supplied body to a stand-alone HTML fragment for the
// editor's right-pane preview. The body is validated by the schema
// (so the editor can never POST a malformed payload) and the
// headings are extracted server-side so the preview pane can render
// the same TOC the published page would.
//
// HTML rendering goes through the dedicated SSR PortableText renderer,
// imported lazily so this resource route doesn't pay the renderer's
// startup cost on cold boot when the editor isn't open.
export const action = defineApiAction({
  method: 'POST',
  input: previewPageBodySchema,
  requireAdmin: true,
  async run({ payload }) {
    const { renderPortableTextToHtml } = await import('@/server/cms/pages/preview')
    const html = await renderPortableTextToHtml(payload.body)
    const headings = collectHeadings(payload.body)
    return { html, headings }
  },
})
