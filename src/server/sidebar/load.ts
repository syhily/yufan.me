import type { BlogSession } from '@/server/session'

import { latestComments, pendingComments as loadPendingComments } from '@/server/comments/loader'
import { isAdmin } from '@/server/session'

export async function loadSidebarData(session: BlogSession) {
  const admin = isAdmin(session)
  const [recentComments, pendingComments] = await Promise.all([
    latestComments(),
    admin ? loadPendingComments() : Promise.resolve([]),
  ])

  return { admin, recentComments, pendingComments }
}
