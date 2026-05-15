import type { RenderMermaidInput, RenderMermaidOutput } from '@/shared/cms-pages'

import { API_ACTIONS } from '@/shared/api-actions'

// Imperative `admin.renderMermaid` call for save flows. Uses the Hono REST API.

export async function fetchRenderMermaid(input: RenderMermaidInput): Promise<RenderMermaidOutput> {
  const res = await fetch(API_ACTIONS.admin.renderMermaid.path, {
    method: API_ACTIONS.admin.renderMermaid.method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
    credentials: 'same-origin',
  })
  let body: RenderMermaidOutput & { error?: { message?: string } }
  try {
    body = (await res.json()) as RenderMermaidOutput & { error?: { message?: string } }
  } catch {
    return { svg: '', error: 'Invalid JSON response' }
  }
  if (!res.ok || body.error) {
    return { svg: '', error: body.error?.message ?? `HTTP ${res.status}` }
  }
  if (body.svg === undefined) {
    return { svg: '', error: 'Empty response' }
  }
  return { svg: body.svg, error: null }
}
