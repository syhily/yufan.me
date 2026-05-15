import { Hono } from 'hono'

import { queryRealtimeTail } from '@/server/analytics/query'
import { apiContract } from '@/shared/contracts'
import { adminCacheContract } from '@/shared/contracts/admin/cache'
import { adminCategoriesContract } from '@/shared/contracts/admin/categories'
import { adminCommentsContract } from '@/shared/contracts/admin/comments'
import { adminFriendsContract } from '@/shared/contracts/admin/friends'
import { adminImagesContract } from '@/shared/contracts/admin/images'
import { adminMailContract } from '@/shared/contracts/admin/mail'
import { adminMusicContract } from '@/shared/contracts/admin/music'
import { adminPagesContract } from '@/shared/contracts/admin/pages'
import { adminPostsContract } from '@/shared/contracts/admin/posts'
import { adminRendersContract } from '@/shared/contracts/admin/renders'
import { adminSettingsContract } from '@/shared/contracts/admin/settings'
import { adminTagsContract } from '@/shared/contracts/admin/tags'
import { adminUsersContract } from '@/shared/contracts/admin/users'

import type { Env } from './context'

import { accountController } from './controllers/account.controller'
import { adminCacheController } from './controllers/admin/cache.controller'
import { adminCategoriesController } from './controllers/admin/categories.controller'
import { adminCommentsController } from './controllers/admin/comments.controller'
import { adminFriendsController } from './controllers/admin/friends.controller'
import { adminImagesController } from './controllers/admin/images.controller'
import { adminMailController } from './controllers/admin/mail.controller'
import { adminMusicController } from './controllers/admin/music.controller'
import { adminPagesController } from './controllers/admin/pages.controller'
import { adminPostsController } from './controllers/admin/posts.controller'
import { adminRendersController } from './controllers/admin/renders.controller'
import { adminSettingsController } from './controllers/admin/settings.controller'
import { adminTagsController } from './controllers/admin/tags.controller'
import { adminUsersController } from './controllers/admin/users.controller'
import { analyticsController } from './controllers/analytics.controller'
import { authController } from './controllers/auth.controller'
import { commentAdminController } from './controllers/comment-admin.controller'
import { commentController } from './controllers/comment.controller'
import { imageController } from './controllers/image.controller'
import { musicController } from './controllers/music.controller'
import { onErrorHandler } from './errors'
import { adminRoute, authorRoute, authedRoute, publicRoute, requireRoleMw } from './guards'

export function createApiApp(): Hono<Env> {
  const app = new Hono<Env>().basePath('/api')

  app.onError(onErrorHandler)

  // Account routes (any authenticated user)
  authedRoute(app, apiContract.account, accountController)

  // Analytics routes (admin only)
  adminRoute(app, apiContract.analytics, analyticsController)

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

  // Public resource routes
  publicRoute(app, apiContract.comment, commentController)
  publicRoute(app, apiContract.image, imageController)
  publicRoute(app, apiContract.music, musicController)

  // Admin comment routes (approve, delete, loadAll, search)
  adminRoute(app, apiContract.commentAdmin, commentAdminController)

  // Admin routes — split by domain and guard
  adminRoute(app, adminUsersContract, adminUsersController)
  adminRoute(app, adminSettingsContract, adminSettingsController)
  adminRoute(app, adminCacheContract, adminCacheController)
  adminRoute(app, adminMailContract, adminMailController)
  adminRoute(app, adminFriendsContract, adminFriendsController)
  adminRoute(app, adminCategoriesContract, adminCategoriesController)
  authorRoute(app, adminTagsContract, adminTagsController)
  authorRoute(app, adminImagesContract, adminImagesController)
  authorRoute(app, adminMusicContract, adminMusicController)
  adminRoute(app, adminPagesContract, adminPagesController)
  authorRoute(app, adminPostsContract, adminPostsController)
  adminRoute(app, adminCommentsContract, adminCommentsController)
  adminRoute(app, adminRendersContract, adminRendersController)

  // Auth routes (admin only)
  adminRoute(app, apiContract.auth, authController)

  return app
}
