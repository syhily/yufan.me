import { z } from 'zod'

import { issueCsrfToken } from '@/server/domains/auth/csrf'
import { publicProc } from '@/server/http/orpc-base'

const refresh = publicProc
  .route({ method: 'GET', path: '/csrf/refresh' })
  .input(z.object({}))
  .output(z.object({ token: z.string() }))
  .handler(async ({ context }) => {
    const { token, setCookie } = await issueCsrfToken(context.request)
    context.responseHeaders.append('Set-Cookie', setCookie)
    return { token }
  })

export const csrfRouter = { refresh }
