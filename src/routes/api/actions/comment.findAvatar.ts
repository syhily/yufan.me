import { z } from 'zod'

import { AvatarStatus, cacheAvatar } from '@/server/cache/avatar'
import { findUserIdByEmail } from '@/server/db/query/user'
import { fetchQQAvatarImage, isQQEmail } from '@/server/images/avatar-fetch'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { encodedEmail } from '@/shared/security'
import { joinUrl } from '@/shared/urls'

const inputSchema = z.object({ email: z.email() })

export const action = defineApiAction({
  method: 'POST',
  input: inputSchema,
  async run({ payload }) {
    const { email } = payload
    const id = await findUserIdByEmail(email)
    const hash = id === null ? await encodedEmail(email) : id

    // Pre-warm the avatar cache for QQ emails so the image route can serve
    // the cached PNG without needing to reverse the hash back to an email.
    if (isQQEmail(email)) {
      const canonicalHash = await encodedEmail(email)
      const buffer = await fetchQQAvatarImage(email)
      if (buffer !== null) {
        await cacheAvatar({ email: canonicalHash, status: AvatarStatus.HAVE_AVATAR, buffer })
      } else {
        await cacheAvatar({ email: canonicalHash, status: AvatarStatus.NO_AVATAR })
      }
    }

    return { avatar: joinUrl(requireBlogSettingsSection('siteIdentity').website, 'images/avatar', `${hash}.png`) }
  },
})
