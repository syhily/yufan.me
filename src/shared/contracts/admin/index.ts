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

export const adminContract = c.router(
  {
    ...adminUsersContract,
    ...adminSettingsContract,
    ...adminCacheContract,
    ...adminMailContract,
    ...adminFriendsContract,
    ...adminCategoriesContract,
    ...adminTagsContract,
    ...adminImagesContract,
    ...adminMusicContract,
    ...adminPagesContract,
    ...adminPostsContract,
    ...adminRendersContract,
  },
  { strictStatusCodes: true },
)

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
