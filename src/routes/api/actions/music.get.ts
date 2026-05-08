import { publicMusicGetSchema } from '@/server/music/schema'
import { getMusicMetaForPlayer } from '@/server/music/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

// Public read endpoint for the browser-side `<MusicPlayer />` and the
// SSR feed enhancer. Keyed on the opaque `playerId` (16-char
// `[a-z0-9]`) MDX writes — never on the provider id, which keeps the
// public URL provider-agnostic.
//
// We lean on HTTP cache headers rather than Redis because the
// payload is fully determined by the row (no per-request branching,
// no auth) and CDN/edge caches will absorb the bulk of the traffic.

export const loader = defineApiAction({
  method: 'GET',
  input: publicMusicGetSchema,
  async run({ payload }) {
    const meta = await getMusicMetaForPlayer(payload.id)
    if (meta === null) {
      throw new ActionFailure(404, '音乐不存在或已下线')
    }
    return {
      data: { music: meta },
      headers: {
        // 30 minutes browser, 60 minutes shared cache. Stale-while-
        // revalidate gives APlayer a smooth refresh when the row is
        // updated through the admin while a reader is mid-session.
        'Cache-Control': 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  },
})
