import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { adminSession, regularSession } from './_helpers/session'

// Drive the editor's inline-math preview endpoint
// (`/api/actions/admin/renderMath`) end-to-end through the
// `defineApiAction` perimeter. We mock only the KaTeX renderer singleton
// so the test stays fast and hermetic.
//
// The endpoint contract under test:
//   - POST-only; GET / PATCH / DELETE return 405.
//   - Admin-gated; non-admin sessions get 403.
//   - Empty `tex` short-circuits to `{ mathml: '', error: null }` and
//     never invokes the renderer (saves a wasted call when the user
//     clears the field mid-typing).
//   - On success, returns the MathML string the renderer produced and
//     `error: null`.
//   - On a TeX error, returns the renderer's error message in
//     `error` with `mathml: ''` — explicitly NOT a 500. This is the
//     contract the `MathInlinePanel` UI depends on so it can flip a
//     "syntax error" badge without breaking the network channel.
//   - The `display` flag is forwarded verbatim so block math (`$$`)
//     and inline math (`$`) reach the right KaTeX pass.
//   - Bodies over the schema's 4KB ceiling are rejected with 400
//     (Zod) before the renderer is touched.

const renderMock = vi.fn<(tex: string, display: boolean) => Promise<string>>()

vi.mock('@/server/pt/katex-renderer', () => ({
  getKatexRenderer: vi.fn(async () => ({
    render: (tex: string, display: boolean) => renderMock(tex, display),
  })),
}))

const { makeLoaderArgs } = await import('./_helpers/context')

const ADMIN_ARGS = (request: Request) => makeLoaderArgs({ request, session: adminSession() })

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/actions/admin/renderMath', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  renderMock.mockReset()
})

describe('routes/api/actions/admin.renderMath', () => {
  it('returns the KaTeX MathML and clears the error envelope on success', async () => {
    renderMock.mockResolvedValueOnce('<math data-katex="ok"><mi>x</mi></math>')

    const { action } = await import('@/routes/api/actions/admin.renderMath')
    const response = await action(ADMIN_ARGS(makePostRequest({ tex: 'x = 1', display: false })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: { mathml: '<math data-katex="ok"><mi>x</mi></math>', error: null },
    })
    expect(renderMock).toHaveBeenCalledWith('x = 1', false)
  })

  it('forwards `display: true` so block-math previews hit the right KaTeX pass', async () => {
    renderMock.mockResolvedValueOnce('<math display="block" />')

    const { action } = await import('@/routes/api/actions/admin.renderMath')
    await action(ADMIN_ARGS(makePostRequest({ tex: '\\int_0^1 x', display: true })))

    expect(renderMock).toHaveBeenCalledWith('\\int_0^1 x', true)
  })

  it('short-circuits on empty tex without invoking the renderer', async () => {
    const { action } = await import('@/routes/api/actions/admin.renderMath')
    const response = await action(ADMIN_ARGS(makePostRequest({ tex: '   ', display: false })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: { mathml: '', error: null },
    })
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('returns the renderer error in the envelope (not as HTTP 500) so the UI can show a syntax-error badge', async () => {
    renderMock.mockRejectedValueOnce(new Error('Undefined control sequence: \\foo'))

    const { action } = await import('@/routes/api/actions/admin.renderMath')
    const response = await action(ADMIN_ARGS(makePostRequest({ tex: '\\foo', display: false })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: { mathml: '', error: 'Undefined control sequence: \\foo' },
    })
  })

  it('allows non-admin sessions to render', async () => {
    renderMock.mockResolvedValueOnce('<math data-katex="ok"><mi>x</mi></math>')

    const { action } = await import('@/routes/api/actions/admin.renderMath')
    const response = await action(
      makeLoaderArgs({
        request: makePostRequest({ tex: 'x', display: false }),
        session: regularSession(),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: { mathml: '<math data-katex="ok"><mi>x</mi></math>', error: null },
    })
    expect(renderMock).toHaveBeenCalledWith('x', false)
  })

  it('rejects GET with 405 — the endpoint is POST-only', async () => {
    const { action } = await import('@/routes/api/actions/admin.renderMath')
    const response = await action(
      ADMIN_ARGS(new Request('http://localhost/api/actions/admin/renderMath', { method: 'GET' })),
    )

    expect(response.status).toBe(405)
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('rejects oversized tex bodies with 400 before the renderer is touched', async () => {
    // 4KB + 1 byte exceeds `renderMathSchema.tex.max(4 * 1024)`. Zod
    // owns the rejection; the renderer must never see the input.
    const oversized = 'x'.repeat(4 * 1024 + 1)

    const { action } = await import('@/routes/api/actions/admin.renderMath')
    const response = await action(ADMIN_ARGS(makePostRequest({ tex: oversized, display: false })))

    expect(response.status).toBe(400)
    expect(renderMock).not.toHaveBeenCalled()
  })
})
