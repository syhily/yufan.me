import type { RenderMathOutput } from '@/shared/cms-pages'

import { renderMathSchema } from '@/server/cms/pages/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'

// Editor inline-math preview endpoint. The bubble-menu panel POSTs
// `{ tex, display }` here on every keystroke (debounced); the response
// carries the MathJax-rendered SVG that the prerender pass would write
// on save, so the preview cannot drift from the published rendering.
//
// Why an admin endpoint instead of bundling MathJax client-side: the
// `mathjax-full` package is ~1MB+ gzipped — the editor route is
// admin-only and we'd rather not spend that budget for a popover that
// renders one to a few characters at a time. The render itself is
// cheap once the engine is warm (single-digit ms per call) and the
// admin session is already a network-tight context.
//
// MathJax errors do NOT translate to HTTP 500: a TeX syntax error mid-
// typing is the *expected* state of the editor most of the time. We
// surface the error inside the JSON envelope as `{ svg: '', error }`
// so the client can keep rendering its last successful preview while
// flipping a small "syntax error" badge — same UX the previous KaTeX
// path implemented locally.
//
// 4KB body cap is enforced via Zod (`renderMathSchema.tex.max`). The
// `defineApiAction` Content-Length pre-flight guards against runaway
// payloads before the body is read at all; the Zod stage is a
// defence-in-depth check on the parsed value.
const MAX_BODY_BYTES = 8 * 1024

export const action = defineApiAction({
  method: 'POST',
  input: renderMathSchema,
  requireAdmin: true,
  maxBodyBytes: MAX_BODY_BYTES,
  async run({ payload }): Promise<RenderMathOutput> {
    const tex = payload.tex
    if (tex.trim() === '') {
      // Empty input is a no-op, not an error. Returning an empty SVG
      // saves the client the round-trip-and-render dance for a value
      // that wouldn't paint anything anyway.
      return { svg: '', error: null }
    }
    let renderer: import('@/server/markdown/mathjax-renderer').MathjaxRenderer
    try {
      // Lazy + singleton — see `@/server/markdown/mathjax-renderer`.
      // The first preview-popover open in a process pays the ~100ms
      // engine boot; subsequent calls (and the save-time prerender
      // pass) re-use the same renderer.
      const { getMathjaxRenderer } = await import('@/server/markdown/mathjax-renderer')
      renderer = await getMathjaxRenderer()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'MathJax 加载失败'
      return { svg: '', error: message }
    }
    try {
      const svg = renderer.render(tex, payload.display)
      return { svg, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : '公式渲染失败'
      return { svg: '', error: message }
    }
  },
})
