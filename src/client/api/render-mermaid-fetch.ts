import type { ApiEnvelope } from '@/shared/api-envelope'
import type { RenderMermaidInput, RenderMermaidOutput } from '@/shared/cms-pages'

import { API_ACTIONS } from '@/shared/api-actions'

/** Imperative `admin.renderMermaid` call for save flows (outside `useApiFetcher`). */
export async function fetchRenderMermaid(input: RenderMermaidInput): Promise<RenderMermaidOutput> {
  const res = await fetch(API_ACTIONS.admin.renderMermaid.path, {
    method: API_ACTIONS.admin.renderMermaid.method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
    credentials: 'same-origin',
  })
  let envelope: ApiEnvelope<RenderMermaidOutput>
  try {
    envelope = (await res.json()) as ApiEnvelope<RenderMermaidOutput>
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
