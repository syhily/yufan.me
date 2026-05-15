import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

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
