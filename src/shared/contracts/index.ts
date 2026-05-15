import { c } from './_base'
import { accountContract } from './account'
import { adminCacheContract } from './admin/cache'
import { adminCategoriesContract } from './admin/categories'
import { adminCommentsContract } from './admin/comments'
import { adminEditorContract } from './admin/editor'
import { adminFriendsContract } from './admin/friends'
import { adminImagesContract } from './admin/images'
import { adminMailContract } from './admin/mail'
import { adminModerationContract } from './admin/moderation'
import { adminMusicContract } from './admin/music'
import { adminPagesContract } from './admin/pages'
import { adminPostsContract } from './admin/posts'
import { adminSearchContract } from './admin/search'
import { adminSessionsContract } from './admin/sessions'
import { adminSettingsContract } from './admin/settings'
import { adminTagsContract } from './admin/tags'
import { adminUsersContract } from './admin/users'
import { analyticsContract } from './analytics'
import { authContract } from './auth'
import { commentContract } from './comment'
import { imageContract } from './image'
import { musicContract } from './music'

export const apiContract = c.router(
  {
    account: accountContract,
    admin: c.router({
      cache: adminCacheContract,
      categories: adminCategoriesContract,
      comments: adminCommentsContract,
      editor: adminEditorContract,
      friends: adminFriendsContract,
      images: adminImagesContract,
      mail: adminMailContract,
      moderation: adminModerationContract,
      music: adminMusicContract,
      pages: adminPagesContract,
      posts: adminPostsContract,
      search: adminSearchContract,
      sessions: adminSessionsContract,
      settings: adminSettingsContract,
      tags: adminTagsContract,
      users: adminUsersContract,
    }),
    analytics: analyticsContract,
    auth: authContract,
    comment: commentContract,
    image: imageContract,
    music: musicContract,
  },
  { pathPrefix: '/api' },
)

export type ApiContract = typeof apiContract
