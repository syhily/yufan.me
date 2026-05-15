import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

export const adminRendersContract = c.router(
  {
    renderMath: {
      method: 'POST',
      path: '/admin/render-math',
      body: z.any() /* TODO: use renderMathSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'renderMath',
    },
    renderMermaid: {
      method: 'POST',
      path: '/admin/render-mermaid',
      body: z.any() /* TODO: use renderMermaidSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'renderMermaid',
    },
    reindexSearch: {
      method: 'POST',
      path: '/admin/reindex-search',
      body: z.any() /* TODO: use reindexInputSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'reindexSearch',
    },
  },
  { strictStatusCodes: true },
)
