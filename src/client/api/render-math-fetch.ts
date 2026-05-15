import type { RenderMathInput, RenderMathOutput } from '@/shared/cms-pages'

import { api } from '@/client/api/client'

// Imperative `admin.renderMath` call for save flows. Uses the ts-rest client.

export async function fetchRenderMath(input: RenderMathInput): Promise<RenderMathOutput> {
  try {
    const result = await api.admin.editor.renderMath({ body: input })
    if (result.status === 200) {
      return result.body
    }
    return {
      mathml: '',
      error: (result.body as { error?: { message?: string } })?.error?.message ?? `HTTP ${String(result.status)}`,
    }
  } catch {
    return { mathml: '', error: 'Invalid JSON response' }
  }
}
