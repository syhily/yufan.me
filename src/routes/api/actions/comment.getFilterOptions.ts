import type { MiddlewareFunction } from 'react-router'

import { getCommentAuthors, getPageOptions } from '@/server/comments/admin'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { adminMiddleware } from '@/server/session'

export const middleware: MiddlewareFunction<Response>[] = [adminMiddleware]

export const loader = defineApiAction({
  method: 'GET',
  async run() {
    const [pages, authors] = await Promise.all([getPageOptions(), getCommentAuthors()])
    return {
      pages,
      authors: authors.map((author) => ({ id: `${author.id}`, name: author.name })),
    }
  },
})
