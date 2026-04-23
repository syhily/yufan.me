import { ActionError, defineAction } from 'astro:actions'

import * as userRepo from '@/data/repositories/user'
import { login } from '@/helpers/auth/session'
import { createAdmin, createUserWithPassword, hasAdmin } from '@/helpers/auth/user'
import { ErrorMessages } from '@/helpers/errors'
import { getLogger } from '@/helpers/logger'
import { signInSchema, signUpAdminSchema, signUpUserSchema, updateUserSchema } from '@/schemas/auth'
import { catchDomain, withAdmin, withCsrf, withRateLimit } from '@/web/actions/middleware'

const log = getLogger('auth')

function loginLog({
  email,
  clientAddress,
  request,
  success,
}: {
  email: string
  clientAddress: string
  request: Request
  success: boolean
}): void {
  const payload = {
    email,
    clientAddress,
    userAgent: request.headers.get('User-Agent'),
  }
  if (success) {
    log.info('login succeeded', payload)
  } else {
    log.warn('login failed', payload)
  }
}

export const auth = {
  signUpAdmin: defineAction({
    accept: 'json',
    input: signUpAdminSchema,
    handler: catchDomain(async ({ name, email, password }) => {
      if (await hasAdmin()) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ErrorMessages.INSTALLATION_DONE,
        })
      }
      const res = await createAdmin(name, email, password)
      if (res.length === 0) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: ErrorMessages.ADMIN_CREATE_FAILED,
        })
      }
      const { id, name: createdName, email: createdEmail } = res[0]
      return { success: true, user: { id, name: createdName, email: createdEmail } }
    }),
  }),
  signUpUser: defineAction({
    accept: 'json',
    input: signUpUserSchema,
    handler: catchDomain(
      withCsrf(
        withRateLimit({ key: 'ip', message: ErrorMessages.TOO_MANY_REQUESTS }, async (input, ctx) => {
          const { name, email, password, confirmPassword } = input
          if (password !== confirmPassword) {
            throw new ActionError({ code: 'BAD_REQUEST', message: ErrorMessages.PASSWORD_MISMATCH })
          }

          const user = await createUserWithPassword(name, email, password, '')
          if (user === null) {
            throw new ActionError({
              code: 'CONFLICT',
              message: ErrorMessages.EMAIL_ALREADY_REGISTERED,
            })
          }

          const loginSuccess = await login({
            email,
            password,
            session: ctx.session!,
            request: ctx.request,
            clientAddress: ctx.clientAddress,
          })
          if (!loginSuccess) {
            throw new ActionError({
              code: 'INTERNAL_SERVER_ERROR',
              message: ErrorMessages.REGISTRATION_FAILED,
            })
          }

          return { success: true, user: { id: user.id, name: user.name, email: user.email } }
        }),
      ),
    ),
  }),
  signIn: defineAction({
    accept: 'json',
    input: signInSchema,
    handler: catchDomain(
      withCsrf(
        withRateLimit(
          { key: 'ip', message: ErrorMessages.TOO_MANY_LOGIN_ATTEMPTS, incrementOnError: false },
          async (input, ctx) => {
            const { email, password } = input
            const success = await login({
              email,
              password,
              session: ctx.session!,
              request: ctx.request,
              clientAddress: ctx.clientAddress,
            })
            loginLog({ email, clientAddress: ctx.clientAddress, request: ctx.request, success })
            if (!success) {
              // Mirror the previous behaviour: bump the rate-limit counter on
              // bad credentials specifically (not on every error).
              const { incrLimit } = await import('@/helpers/cache')
              await incrLimit(ctx.clientAddress)
              throw new ActionError({
                code: 'FORBIDDEN',
                message: ErrorMessages.INVALID_CREDENTIALS,
              })
            }
          },
        ),
      ),
    ),
  }),
  // Update user information (admin only)
  updateUser: defineAction({
    accept: 'json',
    input: updateUserSchema,
    handler: catchDomain(
      withAdmin(async ({ userId, name, email, link, badgeName, badgeColor }) => {
        const updateData: userRepo.UserUpdate = {}
        if (name !== undefined) updateData.name = name
        if (email !== undefined) updateData.email = email
        if (link !== undefined) updateData.link = link
        if (badgeName !== undefined) updateData.badgeName = badgeName
        if (badgeColor !== undefined) updateData.badgeColor = badgeColor

        if (Object.keys(updateData).length === 0) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: '至少需要提供一个更新字段',
          })
        }

        const updated = await userRepo.updateUserById(BigInt(userId), updateData)
        if (updated === null) {
          throw new ActionError({
            code: 'NOT_FOUND',
            message: '用户不存在',
          })
        }

        return { success: true, user: updated }
      }),
    ),
  }),
}
