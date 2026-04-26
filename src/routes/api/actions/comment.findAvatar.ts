import { z } from 'zod'

import config from '@/blog.config'
import { findUserIdByEmail } from '@/server/db/query/user'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { encodedEmail } from '@/shared/security'
import { joinUrl } from '@/shared/urls'

const inputSchema = z.object({ email: z.email() })

export const action = defineApiAction({
  method: 'POST',
  input: inputSchema,
  async run({ payload }) {
    const id = await findUserIdByEmail(payload.email)
    const hash = id === null ? await encodedEmail(payload.email) : id
    return { avatar: joinUrl(config.website, 'images/avatar', `${hash}.png`) }
  },
})
