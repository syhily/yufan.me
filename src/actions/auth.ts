import { z } from 'astro/zod'
import { ActionError, defineAction } from 'astro:actions'
import { validateToken } from '@/helpers/auth/csrf'
import { login } from '@/helpers/auth/session'
import { createAdmin, hasAdmin } from '@/helpers/auth/user'
import { exceedLimit, incrLimit } from '@/helpers/cache'
import options from '@/options'

function loginLog({ email, clientAddress, request, success }: { email: string, clientAddress: string, request: Request, success: boolean }): void {
  if (success) {
    console.warn(`Successfully login into the ${options.website}`, { email, clientAddress, userAgent: request.headers.get('User-Agent') })
  }
  else {
    console.error(`Failed to login into the ${options.website}`, { email, clientAddress, userAgent: request.headers.get('User-Agent') })
  }
}

export const auth = {
  signUpAdmin: defineAction({
    accept: 'json',
    input: z.object({
      name: z.string().min(1),
      email: z.string().email().min(1),
      password: z.string().min(10),
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
  signUpUser: defineAction({
    accept: 'json',
    input: z.object({
      name: z.string().min(1),
      email: z.string().email().min(1),
      password: z.string().min(10),
      confirmPassword: z.string().min(10),
      token: z.string(),
    }),
    handler: async (input, context) => {
      console.error('TODO Complete this method', input, context)
      return {}
    },
  }),
  signIn: defineAction({
    accept: 'json',
    input: z.object({
      email: z.string().email(),
      password: z.string().min(10),
      token: z.string(),
    }),
    handler: async ({ email, password, token }, { session, clientAddress, request }) => {
      if (session === undefined) {
        loginLog({ email, clientAddress, request, success: false })
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Please configure your astro session store',
        })
      }
      const [valid, error] = await validateToken(session, token)
      if (!valid) {
        loginLog({ email, clientAddress, request, success: false })
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: error,
        })
      }

      if (await exceedLimit(clientAddress)) {
        loginLog({ email, clientAddress, request, success: false })
        throw new ActionError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many failed in login, lock for 30 minutes',
        })
      }

      const success = await login({ email, password, session, request, clientAddress })
      loginLog({ email, clientAddress, request, success })
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
