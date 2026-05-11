import { renderMermaidSVGAsync } from 'beautiful-mermaid'

import type { RenderMermaidOutput } from '@/shared/cms-pages'

import { renderMermaidSchema } from '@/server/cms/pages/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'

const MAX_BODY_BYTES = 128 * 1024

export const action = defineApiAction({
  method: 'POST',
  input: renderMermaidSchema,
  requireAdmin: true,
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
