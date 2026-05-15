import { accountRouter } from './controllers/account.controller'
import { adminCacheRouter } from './controllers/admin/cache.controller'
import { adminCategoriesRouter } from './controllers/admin/categories.controller'
import { adminFriendsRouter } from './controllers/admin/friends.controller'
import { adminImagesRouter } from './controllers/admin/images.controller'
import { adminMailRouter } from './controllers/admin/mail.controller'
import { adminMusicRouter } from './controllers/admin/music.controller'
import { adminPagesRouter } from './controllers/admin/pages.controller'
import { adminPostsRouter } from './controllers/admin/posts.controller'
import { adminRendersRouter } from './controllers/admin/renders.controller'
import { adminSettingsRouter } from './controllers/admin/settings.controller'
import { adminTagsRouter } from './controllers/admin/tags.controller'
import { adminUsersRouter } from './controllers/admin/users.controller'
import { analyticsRouter } from './controllers/analytics.controller'
import { commentAdminRouter } from './controllers/comment-admin.controller'
import { commentPublicRouter } from './controllers/comment-public.controller'
import { commentSelfRouter } from './controllers/comment-self.controller'
import { commentTokenRouter } from './controllers/comment-token.controller'
import { imageRouter } from './controllers/image.controller'
import { musicRouter } from './controllers/music.controller'

// The composed oRPC router. The shape is the audit surface for the
// permission matrix — each leaf's guard comes from the base procedure
// it was built from (`publicProc / authedProc / adminProc / authorProc`
// in `src/server/http/orpc-base.ts`). Grep
// `grep -rn "adminProc\|authorProc" src/server/http/controllers/`
// to see every gated procedure in one shot.
export const apiRouter = {
  account: accountRouter,
  analytics: analyticsRouter,
  commentPublic: commentPublicRouter,
  commentSelf: commentSelfRouter,
  commentToken: commentTokenRouter,
  commentAdmin: commentAdminRouter,
  image: imageRouter,
  music: musicRouter,
  admin: {
    users: adminUsersRouter,
    settings: adminSettingsRouter,
    cache: adminCacheRouter,
    mail: adminMailRouter,
    friends: adminFriendsRouter,
    categories: adminCategoriesRouter,
    tags: adminTagsRouter,
    images: adminImagesRouter,
    music: adminMusicRouter,
    pages: adminPagesRouter,
    posts: adminPostsRouter,
    renders: adminRendersRouter,
  },
}

export type ApiRouter = typeof apiRouter
