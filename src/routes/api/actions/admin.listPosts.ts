import { userSession } from '@/server/auth/primitives'
import { listPostsSchema } from '@/server/cms/posts/schema'
import { listPostsForAdmin } from '@/server/cms/posts/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  input: listPostsSchema,
  requireRole: 'author',
  async run({ ctx, payload }) {
    return listPostsForAdmin(
      {
        q: payload.q,
        deletedStatus: payload.deletedStatus,
        offset: payload.offset,
        limit: payload.limit,
        category: payload.category,
        tag: payload.tag,
        published: payload.published,
        visible: payload.visible,
        sortBy: payload.sortBy,
        sortOrder: payload.sortOrder,
        authorId: payload.authorId,
      },
      { userId: userSession(ctx.session)!.id, role: userSession(ctx.session)!.role! },
    )
  },
})
