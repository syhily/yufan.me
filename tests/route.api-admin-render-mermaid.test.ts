import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { adminSession, regularSession } from './_helpers/session'

const renderMermaidMock = vi.fn<(code: string) => Promise<string>>()

vi.mock('beautiful-mermaid', () => ({
  renderMermaidSVGAsync: (code: string) => renderMermaidMock(code),
}))

const { makeLoaderArgs } = await import('./_helpers/context')

const ADMIN_ARGS = (request: Request) => makeLoaderArgs({ request, session: adminSession(), admin: true })

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/actions/admin/renderMermaid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  renderMermaidMock.mockReset()
})

describe('routes/api/actions/admin.renderMermaid', () => {
  it('returns the Mermaid SVG and clears the error envelope on success', async () => {
    renderMermaidMock.mockResolvedValueOnce('<svg data-mermaid="ok"/>')

    const { action } = await import('@/routes/api/actions/admin.renderMermaid')
    const response = await action(ADMIN_ARGS(makePostRequest({ code: 'graph TD\n  A-->B' })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: { svg: '<svg data-mermaid="ok"/>', error: null },
    })
    expect(renderMermaidMock).toHaveBeenCalledWith('graph TD\n  A-->B')
  })

  it('short-circuits on empty code without invoking the renderer', async () => {
    const { action } = await import('@/routes/api/actions/admin.renderMermaid')
    const response = await action(ADMIN_ARGS(makePostRequest({ code: '   ' })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: { svg: '', error: null },
    })
    expect(renderMermaidMock).not.toHaveBeenCalled()
  })

  it('returns the renderer error in the envelope (not as HTTP 500)', async () => {
    renderMermaidMock.mockRejectedValueOnce(new Error('Parse error'))

    const { action } = await import('@/routes/api/actions/admin.renderMermaid')
    const response = await action(ADMIN_ARGS(makePostRequest({ code: 'not valid' })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: { svg: '', error: 'Parse error' },
    })
  })

  it('rejects non-admin sessions with 403', async () => {
    const { action } = await import('@/routes/api/actions/admin.renderMermaid')
    const response = await action(
      makeLoaderArgs({
        request: makePostRequest({ code: 'graph TD' }),
        session: regularSession(),
        admin: false,
      }),
    )

    expect(response.status).toBe(403)
    expect(renderMermaidMock).not.toHaveBeenCalled()
  })

  it('rejects GET with 405 — the endpoint is POST-only', async () => {
    const { action } = await import('@/routes/api/actions/admin.renderMermaid')
    const response = await action(
      ADMIN_ARGS(new Request('http://localhost/api/actions/admin/renderMermaid', { method: 'GET' })),
    )

    expect(response.status).toBe(405)
    expect(renderMermaidMock).not.toHaveBeenCalled()
  })

  it('rejects oversized code bodies with 400 before the renderer is touched', async () => {
    const oversized = 'x'.repeat(64 * 1024 + 1)

    const { action } = await import('@/routes/api/actions/admin.renderMermaid')
    const response = await action(ADMIN_ARGS(makePostRequest({ code: oversized })))

    expect(response.status).toBe(400)
    expect(renderMermaidMock).not.toHaveBeenCalled()
  })
})
