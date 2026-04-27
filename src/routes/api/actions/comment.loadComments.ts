import config from '@/blog.config'
import { loadComments, parseComments, streamLoadComments } from '@/server/comments/loader'
import { loadCommentsSchema } from '@/server/comments/schema'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

export const loader = defineApiAction({
  method: 'GET',
  input: loadCommentsSchema,
  async run({ ctx, payload }) {
    // Two response modes share one URL:
    //
    //   - `Accept: application/x-ndjson` — line-delimited JSON. Each root
    //     comment subtree streams out as soon as its MDX (and its
    //     children's MDX) finishes compiling. The first byte hits the
    //     wire while later roots are still compiling, so the client
    //     hydrates incrementally.
    //   - default — the historical single-shot envelope
    //     `{ comments, next }`. Kept so older clients and curl probes
    //     continue to work.
    const accept = ctx.request.headers.get('Accept') ?? ''
    if (accept.includes('application/x-ndjson')) {
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder()
          try {
            for await (const line of streamLoadComments(ctx.session, payload.page_key, payload.offset)) {
              controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`))
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : '无法连接到评论服务器'
            controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'error', message })}\n`))
          } finally {
            controller.close()
          }
        },
      })
      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    const comments = await loadComments(ctx.session, payload.page_key, null, payload.offset)
    if (comments === null) {
      throw new ActionFailure(500, '无法连接到评论服务器')
    }
    const items = await parseComments(comments.comments)
    const next = config.settings.comments.size + payload.offset < comments.roots_count
    return { comments: items, next }
  },
})
