import type { RenderMathInput, RenderMathOutput } from '@/shared/cms-pages'

import { API_ACTIONS } from '@/shared/api-actions'

/** Imperative `admin.renderMath` call for save flows (outside `useApiFetcher`). */
export async function fetchRenderMath(input: RenderMathInput): Promise<RenderMathOutput> {
  const res = await fetch(API_ACTIONS.admin.renderMath.path, {
    method: API_ACTIONS.admin.renderMath.method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
    credentials: 'same-origin',
  })

  let body: RenderMathOutput
  try {
    body = (await res.json()) as RenderMathOutput
  } catch {
    return { mathml: '', error: 'Invalid JSON response' }
  }

  if (!res.ok) {
    return { mathml: '', error: `HTTP ${res.status}` }
  }

  return body
}
