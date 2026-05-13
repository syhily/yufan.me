import type { BlogSession } from '@/server/session'

import { latestComments, pendingComments as loadPendingComments } from '@/server/comments/loader'
import { userSession } from '@/server/session'

export async function loadSidebarData(session: BlogSession) {
  const admin = userSession(session)?.role === 'admin'
  const [recentComments, pendingComments] = await Promise.all([
    latestComments(),
    admin ? loadPendingComments() : Promise.resolve([]),
  ])

  return { admin, recentComments, pendingComments }
}
