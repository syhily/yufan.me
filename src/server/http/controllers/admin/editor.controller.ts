import { renderMermaidSVGAsync } from 'beautiful-mermaid'

import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { adminEditorContract } from '@/shared/contracts/admin/editor'

import { ok } from '@/server/http/response'
import { body } from '@/server/http/ts-rest-adapter'
import { getKatexRenderer } from '@/server/pt/katex-renderer'

interface RenderMathBody {
  tex: string
  display: boolean
}

interface RenderMermaidBody {
  code: string
}

export const adminEditorController: ContractImpl<typeof adminEditorContract> = {
  renderMath: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const b = body<RenderMathBody>(args)
    const tex = b.tex
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
      const mathml = await renderer.render(tex, b.display)
      return ok({ mathml, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : '公式渲染失败'
      return ok({ mathml: '', error: message })
    }
  },

  renderMermaid: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const b = body<RenderMermaidBody>(args)
    const code = b.code
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
