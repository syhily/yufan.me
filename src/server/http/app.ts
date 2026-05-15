import { Hono } from 'hono'

import { apiContract } from '@/shared/contracts'

import type { Env } from './context'

import { accountController } from './controllers/account.controller'
import { adminCacheController } from './controllers/admin/cache.controller'
import { adminCategoriesController } from './controllers/admin/categories.controller'
import { adminCommentsController } from './controllers/admin/comments.controller'
import { adminEditorController } from './controllers/admin/editor.controller'
import { adminFriendsController } from './controllers/admin/friends.controller'
import { adminImagesController } from './controllers/admin/images.controller'
import { adminMailController } from './controllers/admin/mail.controller'
import { adminModerationController } from './controllers/admin/moderation.controller'
import { adminMusicController } from './controllers/admin/music.controller'
import { adminPagesController } from './controllers/admin/pages.controller'
import { adminPostsController } from './controllers/admin/posts.controller'
import { adminSearchController } from './controllers/admin/search.controller'
import { adminSessionsController } from './controllers/admin/sessions.controller'
import { adminSettingsController } from './controllers/admin/settings.controller'
import { adminTagsController } from './controllers/admin/tags.controller'
import { adminUsersController } from './controllers/admin/users.controller'
import { analyticsController } from './controllers/analytics.controller'
import { authController } from './controllers/auth.controller'
import { commentController } from './controllers/comment.controller'
import { imageController } from './controllers/image.controller'
import { musicController } from './controllers/music.controller'
import { onErrorHandler } from './errors'
import { adminRoute, authorRoute, authedRoute, publicRoute } from './guards'

export function createApiApp(): Hono<Env> {
  const app = new Hono<Env>()

  app.onError(onErrorHandler)

  // Permission matrix — the single file to audit API security.
  authedRoute(app, apiContract.account, accountController)
  adminRoute(app, apiContract.admin.users, adminUsersController)
  adminRoute(app, apiContract.admin.cache, adminCacheController)
  adminRoute(app, apiContract.admin.categories, adminCategoriesController)
  adminRoute(app, apiContract.admin.comments, adminCommentsController)
  adminRoute(app, apiContract.admin.editor, adminEditorController)
  adminRoute(app, apiContract.admin.friends, adminFriendsController)
  adminRoute(app, apiContract.admin.images, adminImagesController)
  adminRoute(app, apiContract.admin.mail, adminMailController)
  adminRoute(app, apiContract.admin.moderation, adminModerationController)
  adminRoute(app, apiContract.admin.music, adminMusicController)
  authorRoute(app, apiContract.admin.posts, adminPostsController)
  authorRoute(app, apiContract.admin.pages, adminPagesController)
  adminRoute(app, apiContract.admin.search, adminSearchController)
  adminRoute(app, apiContract.admin.sessions, adminSessionsController)
  adminRoute(app, apiContract.admin.settings, adminSettingsController)
  adminRoute(app, apiContract.admin.tags, adminTagsController)
  adminRoute(app, apiContract.analytics, analyticsController)
  adminRoute(app, apiContract.auth, authController)
  publicRoute(app, apiContract.comment, commentController)
  publicRoute(app, apiContract.image, imageController)
  publicRoute(app, apiContract.music, musicController)

  return app
}
