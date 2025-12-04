import { z } from 'astro/zod'
import { ActionError, defineAction } from 'astro:actions'
import { validateToken } from '@/helpers/auth/csrf'
import { login } from '@/helpers/auth/session'
import { createAdmin, createUserWithPassword, hasAdmin } from '@/helpers/auth/user'
import { exceedLimit, incrLimit } from '@/helpers/cache'
import { ErrorMessages } from '@/helpers/errors'

function loginLog({ email, clientAddress, request, success }: { email: string, clientAddress: string, request: Request, success: boolean }): void {
  if (success) {
    console.warn(`Successfully login into the ${import.meta.env.SITE}`, { email, clientAddress, userAgent: request.headers.get('User-Agent') })
  }
  else {
    console.error(`Failed to login into the ${import.meta.env.SITE}`, { email, clientAddress, userAgent: request.headers.get('User-Agent') })
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
          message: ErrorMessages.INSTALLATION_DONE,
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
          message: ErrorMessages.ADMIN_CREATE_FAILED,
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
    handler: async ({ name, email, password, confirmPassword, token }, { session, clientAddress, request }) => {
      // Validate password match
      if (password !== confirmPassword) {
        throw new ActionError({
          code: 'BAD_REQUEST',
          message: ErrorMessages.PASSWORD_MISMATCH,
        })
      }

      // Validate session
      if (session === undefined) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ErrorMessages.SESSION_NOT_CONFIGURED,
        })
      }

      // Validate CSRF token
      const [valid, error] = await validateToken(session, token)
      if (!valid) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: error,
        })
      }

      // Check rate limit
      if (await exceedLimit(clientAddress)) {
        throw new ActionError({
          code: 'TOO_MANY_REQUESTS',
          message: ErrorMessages.TOO_MANY_REQUESTS,
        })
      }

      // Create user with password
      const user = await createUserWithPassword(name, email, password, '')
      if (user === null) {
        await incrLimit(clientAddress)
        throw new ActionError({
          code: 'CONFLICT',
          message: ErrorMessages.EMAIL_ALREADY_REGISTERED,
        })
      }

      // Auto login after registration
      const loginSuccess = await login({ email, password, session, request, clientAddress })
      if (!loginSuccess) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ErrorMessages.REGISTRATION_FAILED,
        })
      }

      return { success: true, user: { id: user.id, name: user.name, email: user.email } }
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
          message: ErrorMessages.SESSION_NOT_CONFIGURED,
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
          message: ErrorMessages.TOO_MANY_LOGIN_ATTEMPTS,
        })
      }

      const success = await login({ email, password, session, request, clientAddress })
      loginLog({ email, clientAddress, request, success })
      if (!success) {
        await incrLimit(clientAddress)
        throw new ActionError({
          code: 'FORBIDDEN',
          message: ErrorMessages.INVALID_CREDENTIALS,
        })
      }
    },
  }),
}
