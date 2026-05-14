import { queryRealtimeTail } from '@/server/analytics/query'
import { requireUserRole } from '@/server/auth/rbac'
import { runApi } from '@/server/route-helpers/api-handler'
import { userSession } from '@/server/session'

import type { Route } from './+types/analytics.events'

// Realtime tail of `access_log` rows for the dashboard's
// `/wp-admin/analytics/realtime` view. Server-Sent Events because:
//
//   * Single-direction broadcast — server pushes; no client commands.
//   * SSE survives the Node platform's HTTP/1.1 keep-alive without
//     extra deps; the polyfill `EventSource` lives in every modern
//     browser already.
//   * The dashboard does not need 2026-era throughput here. A 2-second
//     poll on `ts > lastSeen` is plenty.
//
// We deliberately do NOT use Redis pub/sub here. The `AccessLogBatcher`
// flushes every 1s to Postgres anyway, so polling Postgres with a
// `ts > lastSeen` index lookup is cheaper than reading from the pool +
// fanning out to subscribers, and it has the bonus that survivability
// across replicas is free.
//
// Routed through `runApi()` so the unified error / response envelope
// contract that `tests/route.api-actions.test.ts` enforces holds —
// the handler returns a `Response` directly and `runApi`'s
// `if (result instanceof Response) return result` short-circuit
// forwards it without touching the headers.

const POLL_INTERVAL_MS = 2_000
const HEARTBEAT_INTERVAL_MS = 25_000

export function loader(args: Route.LoaderArgs) {
  return runApi(args, async (ctx) => {
    requireUserRole(userSession(ctx.session), 'admin')

    const sinceParam = ctx.url.searchParams.get('since')
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
            // already closed
          }
        }

        ctx.request.signal.addEventListener('abort', close)

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

        // Open the stream with a comment line so reverse proxies that
        // buffer the response headers (e.g. nginx without
        // `X-Accel-Buffering: no`) commit the first chunk.
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
                // Rows arrive newest-first; reverse so the client
                // appends in chronological order.
                const ordered = [...rows].reverse()
                lastSeen = new Date(ordered[ordered.length - 1]!.ts)
                send('events', ordered)
              }
            } catch {
              // Transient DB error → swallow; the next tick will retry.
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
}
