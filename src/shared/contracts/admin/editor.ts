import { z } from 'zod'

import { c } from '../_base'
import { standardMutationErrors } from '../_errors'

export const adminEditorContract = c.router(
  {
    renderMath: {
      method: 'POST',
      path: '/admin/editor/render-math',
      body: z.object({
        tex: z.string().max(4 * 1024, 'TeX 表达式过长'),
        display: z.coerce.boolean(),
      }),
      responses: {
        200: z.object({ mathml: z.string(), error: z.string().nullable() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：渲染 KaTeX 公式预览',
    },
    renderMermaid: {
      method: 'POST',
      path: '/admin/editor/render-mermaid',
      body: z.object({
        code: z.string().max(64 * 1024, 'Mermaid 源码过长'),
      }),
      responses: {
        200: z.object({ svg: z.string(), error: z.string().nullable() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：渲染 Mermaid 图表预览',
    },
  },
  { strictStatusCodes: true },
)
