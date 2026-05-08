import { renderPortableTextToHtml } from '@/server/cms/posts/preview'
import { previewPostBodySchema } from '@/server/cms/posts/schema'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { deriveSlug } from '@/server/slug'
import { collectHeadings } from '@/shared/pt/schema'

const MAX_BODY_BYTES = 1 * 1024 * 1024

export const action = defineGuardedApiAction({
  method: 'POST',
  input: previewPostBodySchema,
  requireRole: 'author',
  maxBodyBytes: MAX_BODY_BYTES,
  async run({ payload }) {
    const html = await renderPortableTextToHtml(payload.body)
    const headings = collectHeadings(payload.body, deriveSlug)
    return { html, headings }
  },
})
