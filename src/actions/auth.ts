import { z } from 'astro/zod'
import { defineAction } from 'astro:actions'

export const authActions = {
  registerAdmin: defineAction({
    accept: 'form',
    input: z.object({
      name: z.string(),
      email: z.string(),
      password: z.string(),
    }),
    handler: async ({ name, email, password }) => {
      // TODO Auth register.
      console.error(name, email, password)
    },
  }),
}
