import { renderMermaidSVGAsync } from 'beautiful-mermaid'

import type { RenderMermaidOutput } from '@/shared/cms-pages'

import { renderMermaidSchema } from '@/server/cms/pages/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'

const MAX_BODY_BYTES = 128 * 1024

// NB: the `admin/` URL prefix is by-convention to group editor-side
// endpoints together; this route is intentionally unguarded — pure
// stateless renderer with CSRF as the only gate.
export const action = defineApiAction({
  method: 'POST',
  input: renderMermaidSchema,
  // Open to any visitor with a CSRF cookie — the endpoint is a pure
  // stateless renderer (Mermaid → SVG) with no side effects.
  maxBodyBytes: MAX_BODY_BYTES,
  async run({ payload }): Promise<RenderMermaidOutput> {
    const code = payload.code
    if (code.trim() === '') {
      return { svg: '', error: null }
    }
    try {
      const svg = await renderMermaidSVGAsync(code)
      return { svg, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : '图表渲染失败'
      return { svg: '', error: message }
    }
  },
})
