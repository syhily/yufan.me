import { z } from 'astro/zod'
import { ActionError, defineAction } from 'astro:actions'
import { hasAdmin } from '@/helpers/auth/query'
import { createAdmin } from '@/helpers/auth/user'

export const authActions = {
  registerAdmin: defineAction({
    accept: 'form',
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
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'failed to create admin account',
      })
    },
  }),
  userLogin: defineAction({
    accept: 'form',
    input: z.object({
      email: z.string(),
      password: z.string(),
    }),
    handler: async ({ email, password }) => {
      // TODO
      console.error(email, password)
    },
  }),
}
