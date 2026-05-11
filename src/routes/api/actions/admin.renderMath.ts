import type { RenderMathOutput } from '@/shared/cms-pages'

import { renderMathSchema } from '@/server/cms/pages/schema'
import { getKatexRenderer, type KatexRenderer } from '@/server/pt/katex-renderer'
import { defineApiAction } from '@/server/route-helpers/api-handler'

// Editor inline-math preview endpoint. The bubble-menu panel POSTs
// `{ tex, display }` here on every keystroke (debounced); the response
// carries the KaTeX-rendered MathML that the prerender pass would write
// on save, so the preview cannot drift from the published rendering.
//
// Why an admin endpoint instead of bundling another renderer client-side:
// the save path must use the same server implementation, and the admin
// session is already a network-tight context.
//
// KaTeX errors do NOT translate to HTTP 500: a TeX syntax error mid-
// typing is the *expected* state of the editor most of the time. We
// surface the error inside the JSON envelope as `{ mathml: '', error }`
// so the client can keep rendering its last successful preview while
// flipping a small "syntax error" badge.
//
// 4KB body cap is enforced via Zod (`renderMathSchema.tex.max`). The
// `defineApiAction` Content-Length pre-flight guards against runaway
// payloads before the body is read at all; the Zod stage is a
// defence-in-depth check on the parsed value.
const MAX_BODY_BYTES = 8 * 1024

export const action = defineApiAction({
  method: 'POST',
  input: renderMathSchema,
  // Open to any visitor with a CSRF cookie — the endpoint is a pure
  // stateless renderer (Katex → MathML) with no side effects.
  maxBodyBytes: MAX_BODY_BYTES,
  async run({ payload }): Promise<RenderMathOutput> {
    const tex = payload.tex
    if (tex.trim() === '') {
      // Empty input is a no-op, not an error. Returning empty MathML
      // saves the client the round-trip-and-render dance for a value
      // that wouldn't paint anything anyway.
      return { mathml: '', error: null }
    }
    let renderer: KatexRenderer
    try {
      renderer = await getKatexRenderer()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'KaTeX 加载失败'
      return { mathml: '', error: message }
    }
    try {
      const mathml = await renderer.render(tex, payload.display)
      return { mathml, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : '公式渲染失败'
      return { mathml: '', error: message }
    }
  },
})
