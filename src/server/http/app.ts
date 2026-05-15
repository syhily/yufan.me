import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import { apiContract } from '@/shared/contracts'

import type { Env } from './context'

import { accountController } from './controllers/account.controller'
import { adminCacheController } from './controllers/admin/cache.controller'
import { adminCategoriesController } from './controllers/admin/categories.controller'
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
import { commentAdminController } from './controllers/comment-admin.controller'
import { commentPublicController } from './controllers/comment-public.controller'
import { commentSelfController } from './controllers/comment-self.controller'
import { commentTokenController } from './controllers/comment-token.controller'
import { imageController } from './controllers/image.controller'
import { musicController } from './controllers/music.controller'
import { adminRoute, authorRoute, authedRoute, publicRoute } from './guards'

export function createApiApp(): Hono<Env> {
  const app = new Hono<Env>().basePath('/api')

  app.use(
    bodyLimit({
      maxSize: 10 * 1024 * 1024, // 10 MB
      onError: (c) => c.json({ error: { message: '请求体过大' } }, 413),
    }),
  )

  // ─── Permission matrix ────────────────────────────────
  // Single block: `Ctrl-F` here to audit which contract sits under
  // which guard. Each line is a contract + controller pair plus the
  // RBAC factory (`publicRoute / authedRoute / adminRoute / authorRoute`)
  // that wraps it. The nested admin tree means each sub-domain mounts
  // independently — no flat-spread surprises.

  // Account routes (any authenticated user)
  authedRoute(app, apiContract.account, accountController)

  // Analytics routes (admin only)
  adminRoute(app, apiContract.analytics, analyticsController)

  // Public resource routes
  publicRoute(app, apiContract.commentPublic, commentPublicController)
  publicRoute(app, apiContract.commentToken, commentTokenController)
  publicRoute(app, apiContract.image, imageController)
  publicRoute(app, apiContract.music, musicController)

  // Self-service comment routes (authed)
  authedRoute(app, apiContract.commentSelf, commentSelfController)

  // Admin comment routes (approve, delete, loadAll, search)
  adminRoute(app, apiContract.commentAdmin, commentAdminController)

  // Admin routes — nested under `apiContract.admin.<domain>`. Authors
  // can write tags / images / music / posts; everything else is admin-only.
  adminRoute(app, apiContract.admin.users, adminUsersController)
  adminRoute(app, apiContract.admin.settings, adminSettingsController)
  adminRoute(app, apiContract.admin.cache, adminCacheController)
  adminRoute(app, apiContract.admin.mail, adminMailController)
  adminRoute(app, apiContract.admin.friends, adminFriendsController)
  adminRoute(app, apiContract.admin.categories, adminCategoriesController)
  authorRoute(app, apiContract.admin.tags, adminTagsController)
  authorRoute(app, apiContract.admin.images, adminImagesController)
  authorRoute(app, apiContract.admin.music, adminMusicController)
  adminRoute(app, apiContract.admin.pages, adminPagesController)
  authorRoute(app, apiContract.admin.posts, adminPostsController)
  adminRoute(app, apiContract.admin.renders, adminRendersController)

  return app
}
