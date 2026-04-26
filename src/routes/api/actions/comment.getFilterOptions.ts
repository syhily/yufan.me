import { getCommentAuthors, getPageOptions } from '@/server/comments/admin'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  requireAdmin: true,
  async run() {
    const [pages, authors] = await Promise.all([getPageOptions(), getCommentAuthors()])
    return {
      pages,
      authors: authors.map((author) => ({ id: `${author.id}`, name: author.name })),
    }
  },
})
