import { z } from 'astro/zod'
import { ActionError, defineAction } from 'astro:actions'
import { validateToken } from '@/helpers/auth/csrf'
import { login } from '@/helpers/auth/session'
import { createAdmin, hasAdmin } from '@/helpers/auth/user'
import { exceedLimit, incrLimit } from '@/helpers/cache/redis'

export const authActions = {
  registerAdmin: defineAction({
    accept: 'json',
    input: z.object({
      name: z.string(),
      email: z.string(),
      password: z.string(),
    }),
    handler: async ({ name, email, password }) => {
      if (await hasAdmin()) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'the installation is done',
        })
      }
      const res = await createAdmin(name, email, password)
      if (res !== null && res.length > 0) {
        const { id, name, email } = res[0]
        return { success: true, user: { id, name, email } }
      }
      else {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'failed to create admin account',
        })
      }
    },
  }),
  userLogin: defineAction({
    accept: 'json',
    input: z.object({
      email: z.string(),
      password: z.string(),
      token: z.string(),
    }),
    handler: async ({ email, password, token }, { session, clientAddress, request }) => {
      if (session === undefined) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Please configure your astro session store',
        })
      }
      const [valid, error] = await validateToken(session, token)
      if (!valid) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: error,
        })
      }

      if (await exceedLimit(clientAddress)) {
        throw new ActionError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many failed in login, lock for 30 minutes',
        })
      }

      const success = await login({ email, password, session, request, clientAddress })
      if (!success) {
        await incrLimit(clientAddress)
        throw new ActionError({
          code: 'FORBIDDEN',
          message: 'Invalid login credential.',
        })
      }
    },
  }),
}
