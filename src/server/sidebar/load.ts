import { cache } from 'react'

import type { BlogSession } from '@/server/session'

import { latestComments, pendingComments as loadPendingComments } from '@/server/comments/loader'
import { isAdmin } from '@/server/session'

// Resolved once per request through `React.cache` (the
// `vercel-react-best-practices/server-cache-react` rule). The home loader
// kicks the sidebar fetch off in parallel with the listing pipeline; detail
// loaders fetch it again from `loadDetailPageCritical`. Without `cache()`
// the two SSR call paths each issue an independent Redis round-trip for
// the recent-comment + pending-comment widgets. The session object is the
// same reference for the whole request (set once by `sessionMiddleware`),
// so it's a safe `cache()` key.
export const loadSidebarData = cache(async (session: BlogSession) => {
  const admin = isAdmin(session)
  const [recentComments, pendingComments] = await Promise.all([
    latestComments(),
    admin ? loadPendingComments() : Promise.resolve([]),
  ])

  return { admin, recentComments, pendingComments }
})
