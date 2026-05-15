import type { RenderMathInput, RenderMathOutput } from '@/shared/cms-pages'

import { API_ACTIONS } from '@/shared/api-actions'

// Imperative `admin.renderMath` call for save flows. Uses the Hono REST API.

export async function fetchRenderMath(input: RenderMathInput): Promise<RenderMathOutput> {
  const res = await fetch(API_ACTIONS.admin.renderMath.path, {
    method: API_ACTIONS.admin.renderMath.method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
    credentials: 'same-origin',
  })
  let body: RenderMathOutput & { error?: { message?: string } }
  try {
    body = (await res.json()) as RenderMathOutput & { error?: { message?: string } }
  } catch {
    return { mathml: '', error: 'Invalid JSON response' }
  }
  if (!res.ok || body.error) {
    return { mathml: '', error: body.error?.message ?? `HTTP ${res.status}` }
  }
  if (body.mathml === undefined) {
    return { mathml: '', error: 'Empty response' }
  }
  return { mathml: body.mathml, error: null }
}
