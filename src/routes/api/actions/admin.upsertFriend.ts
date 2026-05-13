import { upsertFriendSchema } from '@/server/friends/schema'
import { upsertAdminFriend } from '@/server/friends/service'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

export const action = defineGuardedApiAction({
  method: 'POST',
  input: upsertFriendSchema,
  requireRole: 'admin',
  async run({ payload }) {
    const friend = await upsertAdminFriend({
      id: payload.id !== undefined ? BigInt(payload.id) : undefined,
      website: payload.website,
      description: payload.description ?? null,
      homepage: payload.homepage,
      poster: payload.poster,
      rssUrl: payload.rssUrl ?? null,
      visible: payload.visible,
    })
    // Invalidate the in-process catalog so the very next public render
    // (and the thumbhash hydration that piggybacks on it) sees the
    // fresh row instead of the stale snapshot from process start.
    return { friend }
  },
})
