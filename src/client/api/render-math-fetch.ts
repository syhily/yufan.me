import type { ApiEnvelope } from '@/shared/api-envelope'
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
  let envelope: ApiEnvelope<RenderMathOutput>
  try {
    envelope = (await res.json()) as ApiEnvelope<RenderMathOutput>
  } catch {
    return { svg: '', error: 'Invalid JSON response' }
  }
  if (!res.ok || envelope.error !== undefined) {
    return {
      svg: '',
      error: envelope.error?.message ?? `HTTP ${res.status}`,
    }
  }
  if (envelope.data === undefined) {
    return { svg: '', error: 'Empty envelope' }
  }
  return envelope.data
}
