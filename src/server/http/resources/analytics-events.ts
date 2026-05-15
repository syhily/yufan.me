import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import type { Env } from '@/server/http/context'

import { queryRealtimeTail } from '@/server/analytics/query'
import { hasAtLeast } from '@/shared/roles'

const POLL_INTERVAL_MS = 2_000
const HEARTBEAT_INTERVAL_MS = 25_000

const requireAdmin = createMiddleware<Env>(async (c, next) => {
  const user = c.var.session.get('user')
  if (!user || !hasAtLeast(user.role, 'admin')) {
    throw new HTTPException(403, { message: '权限不足' })
  }
  await next()
})

export const analyticsEventsRouter = new Hono<Env>().use(requireAdmin).get('/api/analytics/events', (c) => {
  const sinceParam = c.req.query('since')
  let lastSeen = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60_000)
  if (Number.isNaN(lastSeen.getTime())) {
    lastSeen = new Date(Date.now() - 60_000)
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const close = () => {
        if (closed) {
          return
        }
        closed = true
        clearInterval(pollTimer)
        clearInterval(heartbeatTimer)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      c.req.raw.signal.addEventListener('abort', close)

      const send = (eventName: string, data: unknown) => {
        if (closed) {
          return
        }
        try {
          controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          close()
        }
      }

      try {
        controller.enqueue(encoder.encode(': hello\n\n'))
      } catch {
        close()
        return
      }

      const pollTimer = setInterval(() => {
        void (async () => {
          if (closed) {
            return
          }
          try {
            const rows = await queryRealtimeTail(lastSeen)
            if (rows.length > 0) {
              const ordered = [...rows].reverse()
              lastSeen = new Date(ordered[ordered.length - 1]!.ts)
              send('events', ordered)
            }
          } catch {
            /* transient DB error, retry next tick */
          }
        })()
      }, POLL_INTERVAL_MS)

      const heartbeatTimer = setInterval(() => {
        if (closed) {
          return
        }
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'))
        } catch {
          close()
        }
      }, HEARTBEAT_INTERVAL_MS)
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
})
