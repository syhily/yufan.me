import { defineApiAction } from '@/server/route-helpers/api-handler'
import { loadSidebarData } from '@/server/sidebar/load'

// Resource route counterpart to the SSR `loadSidebarData` so the public
// `clientLoader` can dedupe sidebar fetches across SPA navigations through
// Cache Storage. The payload only carries the *session-dependent* slice —
// recent + pending comments and the admin flag. `posts` and `tags` come
// from the listing/detail catalog data and never need a network round-trip.
//
// Cache strategy:
// - The browser's `clientLoader` reads from Cache Storage first and fires
//   a background revalidation if the cached entry is older than the TTL.
// - This endpoint is *not* part of the public CDN contract: it is gated by
//   the user's session cookie (admin vs. anon) and `Cache-Control:
//   private, max-age=60` keeps shared caches from co-mingling them.
export const loader = defineApiAction({
  method: 'GET',
  async run({ ctx }) {
    const sidebar = await loadSidebarData(ctx.session)
    return {
      data: sidebar,
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    }
  },
})
