import { Hono } from 'hono'

import { queryRealtimeTail } from '@/server/analytics/query'
import { apiContract } from '@/shared/contracts'

import type { Env } from './context'

import { accountController } from './controllers/account.controller'
import { adminController } from './controllers/admin.controller'
import { analyticsController } from './controllers/analytics.controller'
import { authController } from './controllers/auth.controller'
import { commentController } from './controllers/comment.controller'
import { imageController } from './controllers/image.controller'
import { musicController } from './controllers/music.controller'
import { adminRoute, authedRoute, publicRoute, requireRoleMw } from './guards'

export function createApiApp(): Hono<Env> {
  const app = new Hono<Env>()

  // Account routes (any authenticated user)
  authedRoute(app, apiContract.account, accountController as any)

  // Analytics routes (admin only)
  adminRoute(app, apiContract.analytics, analyticsController as any)

  // Analytics SSE events stream (admin only, native Hono route)
  const POLL_INTERVAL_MS = 2_000
  const HEARTBEAT_INTERVAL_MS = 25_000

  app.get('/api/analytics/events', requireRoleMw('admin'), async (c) => {
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
          if (closed) return
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
          if (closed) return
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
            if (closed) return
            try {
              const rows = await queryRealtimeTail(lastSeen)
              if (rows.length > 0) {
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
          if (closed) return
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

  // Public resource routes
  publicRoute(app, apiContract.comment, commentController as any)
  publicRoute(app, apiContract.image, imageController as any)
  publicRoute(app, apiContract.music, musicController as any)

  // Admin routes
  adminRoute(app, apiContract.admin, adminController as any)

  // Auth routes (admin only)
  adminRoute(app, apiContract.auth, authController as any)

  return app
}
