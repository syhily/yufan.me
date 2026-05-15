import { renderMermaidSVGAsync } from 'beautiful-mermaid'

import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'

import { getKatexRenderer, type KatexRenderer } from '@/server/pt/katex-renderer'
import { reindexSearchBatch } from '@/server/search/reindex-service'
import { adminRendersContract } from '@/shared/contracts/admin/renders'

export const adminRendersController: AuthedContractImpl<typeof adminRendersContract> = {
  renderMath: async (args, _ctx) => {
    const payload = args.body
    const tex = payload.tex
    if (tex.trim() === '') {
      return { status: 200 as const, body: { mathml: '', error: null } }
    }
    let renderer: KatexRenderer
    try {
      renderer = await getKatexRenderer()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'KaTeX 加载失败'
      return { status: 200 as const, body: { mathml: '', error: message } }
    }
    try {
      const mathml = await renderer.render(tex, payload.display)
      return { status: 200 as const, body: { mathml, error: null } }
    } catch (err) {
      const message = err instanceof Error ? err.message : '公式渲染失败'
      return { status: 200 as const, body: { mathml: '', error: message } }
    }
  },
  renderMermaid: async (args, _ctx) => {
    const payload = args.body
    const code = payload.code
    if (code.trim() === '') {
      return { status: 200 as const, body: { svg: '', error: null } }
    }
    try {
      const svg = await renderMermaidSVGAsync(code)
      return { status: 200 as const, body: { svg, error: null } }
    } catch (err) {
      const message = err instanceof Error ? err.message : '图表渲染失败'
      return { status: 200 as const, body: { svg: '', error: message } }
    }
  },
  reindexSearch: async (args, _ctx) => {
    const result = await reindexSearchBatch(args.body)
    return { status: 200 as const, body: result }
  },
}
