import { renderMermaidSVGAsync } from 'beautiful-mermaid'

import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { adminEditorContract } from '@/shared/contracts/admin/editor'

import { ok } from '@/server/http/response'
import { getKatexRenderer } from '@/server/pt/katex-renderer'

export const adminEditorController: ContractImpl<typeof adminEditorContract> = {
  renderMath: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const body = args.body as { tex: string; display: boolean }
    const tex = body.tex
    if (tex.trim() === '') {
      return ok({ mathml: '', error: null })
    }
    let renderer
    try {
      renderer = await getKatexRenderer()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'KaTeX 加载失败'
      return ok({ mathml: '', error: message })
    }
    try {
      const mathml = await renderer.render(tex, body.display)
      return ok({ mathml, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : '公式渲染失败'
      return ok({ mathml: '', error: message })
    }
  },

  renderMermaid: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const body = args.body as { code: string }
    const code = body.code
    if (code.trim() === '') {
      return ok({ svg: '', error: null })
    }
    try {
      const svg = await renderMermaidSVGAsync(code)
      return ok({ svg, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : '图表渲染失败'
      return ok({ svg: '', error: message })
    }
  },
}
