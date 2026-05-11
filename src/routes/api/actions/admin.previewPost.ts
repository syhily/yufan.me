import { collectHeadings } from '@/pt/schema'
import { previewPostBodySchema } from '@/server/cms/posts/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { deriveSlug } from '@/server/slug'

const MAX_BODY_BYTES = 1 * 1024 * 1024

export const action = defineApiAction({
  method: 'POST',
  input: previewPostBodySchema,
  requireAdmin: true,
  maxBodyBytes: MAX_BODY_BYTES,
  async run({ payload }) {
    const { renderPortableTextToHtml } = await import('@/server/cms/posts/preview')
    const html = await renderPortableTextToHtml(payload.body)
    const headings = collectHeadings(payload.body, deriveSlug)
    return { html, headings }
  },
})
