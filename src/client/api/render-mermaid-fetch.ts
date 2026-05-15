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

  let body: RenderMermaidOutput
  try {
    body = (await res.json()) as RenderMermaidOutput
  } catch {
    return { svg: '', error: 'Invalid JSON response' }
  }

  if (!res.ok) {
    return { svg: '', error: `HTTP ${res.status}` }
  }

  return body
}
