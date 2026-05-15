import type { RenderMermaidInput, RenderMermaidOutput } from '@/shared/cms-pages'

import { api } from '@/client/api/client'

// Imperative `admin.renderMermaid` call for save flows. Uses the ts-rest client.

export async function fetchRenderMermaid(input: RenderMermaidInput): Promise<RenderMermaidOutput> {
  try {
    const result = await api.admin.editor.renderMermaid({ body: input })
    if (result.status === 200) {
      return result.body
    }
    return {
      svg: '',
      error:
        (result.body as unknown as { error?: { message?: string } })?.error?.message ?? `HTTP ${String(result.status)}`,
    }
  } catch {
    return { svg: '', error: 'Invalid JSON response' }
  }
}
