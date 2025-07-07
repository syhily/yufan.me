import { z } from 'astro/zod'
import { defineAction } from 'astro:actions'
import { authActions } from '@/actions/auth'
import { commentActions } from '@/actions/comment'
import { decreaseLikes, increaseLikes, queryLikes, queryUserId } from '@/helpers/db/query'
import { pages, posts } from '@/helpers/schema'
import { encodedEmail, urlJoin } from '@/helpers/tools'

const keys = [...posts.map(post => post.permalink), ...pages.map(page => page.permalink)]

const commonActions = {
  like: defineAction({
    accept: 'json',
    input: z
      .object({
        key: z.custom<string>(val => keys.includes(val)),
      })
      .and(
        z
          .object({
            action: z.enum(['increase']),
          })
          .or(
            z.object({
              action: z.enum(['decrease']),
              token: z.string().min(1),
            }),
          ),
      ),
    handler: async (input) => {
      // Increase the like counts.
      if (input.action === 'increase') {
        return await increaseLikes(input.key)
      }
      // Decrease the like counts.
      await decreaseLikes(input.key, input.token)
      return { likes: await queryLikes(input.key) }
    },
  }),
  avatar: defineAction({
    accept: 'json',
    input: z.object({ email: z.string().email() }),
    handler: async ({ email }) => {
      const id = await queryUserId(email)
      const hash = id === null ? encodedEmail(email) : `${id}`
      return { avatar: urlJoin(import.meta.env.SITE, 'images/avatar', `${hash}.png`) }
    },
  }),
}

export const server = { ...commonActions, ...authActions, ...commentActions }
