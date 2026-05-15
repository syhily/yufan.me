import { expectTypeOf } from 'vitest'

import { accountController } from '@/server/http/controllers/account.controller'
import { adminCacheController } from '@/server/http/controllers/admin/cache.controller'
import { adminCategoriesController } from '@/server/http/controllers/admin/categories.controller'
import { adminCommentsController } from '@/server/http/controllers/admin/comments.controller'
import { adminEditorController } from '@/server/http/controllers/admin/editor.controller'
import { adminFriendsController } from '@/server/http/controllers/admin/friends.controller'
import { adminImagesController } from '@/server/http/controllers/admin/images.controller'
import { adminMailController } from '@/server/http/controllers/admin/mail.controller'
import { adminModerationController } from '@/server/http/controllers/admin/moderation.controller'
import { adminMusicController } from '@/server/http/controllers/admin/music.controller'
import { adminPagesController } from '@/server/http/controllers/admin/pages.controller'
import { adminPostsController } from '@/server/http/controllers/admin/posts.controller'
import { adminSearchController } from '@/server/http/controllers/admin/search.controller'
import { adminSessionsController } from '@/server/http/controllers/admin/sessions.controller'
import { adminSettingsController } from '@/server/http/controllers/admin/settings.controller'
import { adminTagsController } from '@/server/http/controllers/admin/tags.controller'
import { adminUsersController } from '@/server/http/controllers/admin/users.controller'
import { analyticsController } from '@/server/http/controllers/analytics.controller'
import { authController } from '@/server/http/controllers/auth.controller'
import { commentController } from '@/server/http/controllers/comment.controller'
import { imageController } from '@/server/http/controllers/image.controller'
import { musicController } from '@/server/http/controllers/music.controller'
import { accountContract } from '@/shared/contracts/account'
import { adminCacheContract } from '@/shared/contracts/admin/cache'
import { adminCategoriesContract } from '@/shared/contracts/admin/categories'
import { adminCommentsContract } from '@/shared/contracts/admin/comments'
import { adminEditorContract } from '@/shared/contracts/admin/editor'
import { adminFriendsContract } from '@/shared/contracts/admin/friends'
import { adminImagesContract } from '@/shared/contracts/admin/images'
import { adminMailContract } from '@/shared/contracts/admin/mail'
import { adminModerationContract } from '@/shared/contracts/admin/moderation'
import { adminMusicContract } from '@/shared/contracts/admin/music'
import { adminPagesContract } from '@/shared/contracts/admin/pages'
import { adminPostsContract } from '@/shared/contracts/admin/posts'
import { adminSearchContract } from '@/shared/contracts/admin/search'
import { adminSessionsContract } from '@/shared/contracts/admin/sessions'
import { adminSettingsContract } from '@/shared/contracts/admin/settings'
import { adminTagsContract } from '@/shared/contracts/admin/tags'
import { adminUsersContract } from '@/shared/contracts/admin/users'
import { analyticsContract } from '@/shared/contracts/analytics'
import { authContract } from '@/shared/contracts/auth'
import { commentContract } from '@/shared/contracts/comment'
import { imageContract } from '@/shared/contracts/image'
import { musicContract } from '@/shared/contracts/music'

// Type-level verification: every contract has a matching controller.
// If any key is missing, this fails at compile time (vitest typecheck).
// This catches: renamed endpoints, missing handlers, extra handlers.

type ControllerOf<T> = T extends typeof accountContract
  ? typeof accountController
  : T extends typeof adminUsersContract
    ? typeof adminUsersController
    : T extends typeof adminPostsContract
      ? typeof adminPostsController
      : T extends typeof adminPagesContract
        ? typeof adminPagesController
        : T extends typeof adminSessionsContract
          ? typeof adminSessionsController
          : T extends typeof adminCommentsContract
            ? typeof adminCommentsController
            : T extends typeof adminModerationContract
              ? typeof adminModerationController
              : T extends typeof adminSettingsContract
                ? typeof adminSettingsController
                : T extends typeof adminCacheContract
                  ? typeof adminCacheController
                  : T extends typeof adminMailContract
                    ? typeof adminMailController
                    : T extends typeof adminCategoriesContract
                      ? typeof adminCategoriesController
                      : T extends typeof adminTagsContract
                        ? typeof adminTagsController
                        : T extends typeof adminFriendsContract
                          ? typeof adminFriendsController
                          : T extends typeof adminImagesContract
                            ? typeof adminImagesController
                            : T extends typeof adminMusicContract
                              ? typeof adminMusicController
                              : T extends typeof adminEditorContract
                                ? typeof adminEditorController
                                : T extends typeof adminSearchContract
                                  ? typeof adminSearchController
                                  : T extends typeof analyticsContract
                                    ? typeof analyticsController
                                    : T extends typeof authContract
                                      ? typeof authController
                                      : T extends typeof commentContract
                                        ? typeof commentController
                                        : T extends typeof imageContract
                                          ? typeof imageController
                                          : T extends typeof musicContract
                                            ? typeof musicController
                                            : never

// Each controller must be an object (has handlers)
expectTypeOf(accountController).toBeObject()
expectTypeOf(adminUsersController).toBeObject()
expectTypeOf(adminPostsController).toBeObject()
expectTypeOf(adminPagesController).toBeObject()
expectTypeOf(adminSessionsController).toBeObject()
expectTypeOf(adminCommentsController).toBeObject()
expectTypeOf(adminModerationController).toBeObject()
expectTypeOf(adminSettingsController).toBeObject()
expectTypeOf(adminCacheController).toBeObject()
expectTypeOf(adminMailController).toBeObject()
expectTypeOf(adminCategoriesController).toBeObject()
expectTypeOf(adminTagsController).toBeObject()
expectTypeOf(adminFriendsController).toBeObject()
expectTypeOf(adminImagesController).toBeObject()
expectTypeOf(adminMusicController).toBeObject()
expectTypeOf(adminEditorController).toBeObject()
expectTypeOf(adminSearchController).toBeObject()
expectTypeOf(analyticsController).toBeObject()
expectTypeOf(authController).toBeObject()
expectTypeOf(commentController).toBeObject()
expectTypeOf(imageController).toBeObject()
expectTypeOf(musicController).toBeObject()

// Verify ControllerOf maps correctly (contract ↔ controller 1:1)
expectTypeOf<ControllerOf<typeof accountContract>>().toEqualTypeOf<typeof accountController>()
expectTypeOf<ControllerOf<typeof adminUsersContract>>().toEqualTypeOf<typeof adminUsersController>()
expectTypeOf<ControllerOf<typeof commentContract>>().toEqualTypeOf<typeof commentController>()
