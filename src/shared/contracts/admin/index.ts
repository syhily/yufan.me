import { c } from '@/shared/contracts/_base'

import { adminCacheContract } from './cache'
import { adminCategoriesContract } from './categories'
import { adminFriendsContract } from './friends'
import { adminImagesContract } from './images'
import { adminMailContract } from './mail'
import { adminMusicContract } from './music'
import { adminPagesContract } from './pages'
import { adminPostsContract } from './posts'
import { adminRendersContract } from './renders'
import { adminSettingsContract } from './settings'
import { adminTagsContract } from './tags'
import { adminUsersContract } from './users'

// Nested admin router so the client SDK reads as `api.admin.users.list(...)`
// rather than the legacy flat `api.admin.listUsers(...)`. The nested form
// scopes endpoint names per domain (Plan §3.5, finalization Plan §F1.2).
export const adminContract = c.router({
  cache: adminCacheContract,
  categories: adminCategoriesContract,
  friends: adminFriendsContract,
  images: adminImagesContract,
  mail: adminMailContract,
  music: adminMusicContract,
  pages: adminPagesContract,
  posts: adminPostsContract,
  renders: adminRendersContract,
  settings: adminSettingsContract,
  tags: adminTagsContract,
  users: adminUsersContract,
})

export {
  adminCacheContract,
  adminCategoriesContract,
  adminFriendsContract,
  adminImagesContract,
  adminMailContract,
  adminMusicContract,
  adminPagesContract,
  adminPostsContract,
  adminRendersContract,
  adminSettingsContract,
  adminTagsContract,
  adminUsersContract,
}
