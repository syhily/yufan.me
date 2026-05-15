import { renderMermaidSVGAsync } from 'beautiful-mermaid'
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'

import type { ContractImpl } from '@/server/http/ts-rest-adapter'
import type { PortableTextBody } from '@/shared/pt/schema'

import { db } from '@/server/db/pool'
import { content, post } from '@/server/db/schema'
import { getLogger } from '@/server/logger'
import { getKatexRenderer, type KatexRenderer } from '@/server/pt/katex-renderer'
import { indexPost } from '@/server/search/indexer'
import { userSession } from '@/server/session'
import { adminRendersContract } from '@/shared/contracts/admin/renders'

export const adminRendersController: ContractImpl<typeof adminRendersContract> = {
  renderMath: async (args: any, ctx: any) => {
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
  renderMermaid: async (args: any, ctx: any) => {
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
  reindexSearch: async (args: any, ctx: any) => {
    const payload = args.body
    const rows = await db
      .select({
        id: post.id,
        title: post.title,
        summary: post.summary,
        publishedRevisionId: post.publishedRevisionId,
      })
      .from(post)
      .where(and(isNull(post.deletedAt), eq(post.published, true), isNotNull(post.publishedRevisionId)))
      .orderBy(post.id)

    const total = rows.length

    const useBatching = payload.batchSize !== undefined || payload.offset !== undefined
    const offset = payload.offset ?? 0
    const batchSize = payload.batchSize ?? total
    const batch = useBatching ? rows.slice(offset, offset + batchSize) : rows

    const revisionIds = batch.map((r) => r.publishedRevisionId!).filter(Boolean)
    const contents =
      revisionIds.length > 0 ? await db.select().from(content).where(inArray(content.id, revisionIds)) : []
    const contentMap = new Map(contents.map((c) => [c.id, c]))

    let processed = 0
    let failed = 0
    for (const row of batch) {
      const rev = contentMap.get(row.publishedRevisionId!)
      if (rev) {
        try {
          await indexPost(row.id, row.title, row.summary, rev.body as PortableTextBody)
          processed++
        } catch (err) {
          getLogger('search.reindex').error('Index post failed', {
            postId: String(row.id),
            title: row.title,
            error: err instanceof Error ? err.message : String(err),
          })
          failed++
        }
      }
    }

    const nextOffset = useBatching && offset + batch.length < total ? offset + batch.length : null

    return { status: 200 as const, body: { processed, failed, total, nextOffset } }
  },
}
