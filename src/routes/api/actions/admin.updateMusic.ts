import { updateMusicSchema } from '@/server/music/schema'
import { updateMusicMetadata } from '@/server/music/service'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

// Metadata-only edit for the admin music library. Audio / cover
// bytes and the provider id triplet (source, sourceId, playerId)
// are owned by the upload pipeline and intentionally not part of
// this action's input — see `updateMusicSchema` and the
// `updateMusicMetadata` service for the full reasoning.
export const action = defineGuardedApiAction({
  method: 'PATCH',
  input: updateMusicSchema,
  requireRole: 'author',
  async run({ payload }) {
    const music = await updateMusicMetadata({
      id: BigInt(payload.id),
      name: payload.name,
      artist: payload.artist,
      album: payload.album,
      lyric: payload.lyric,
    })
    return { music }
  },
})
