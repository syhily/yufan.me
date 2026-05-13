import type { BlogSession } from '@/server/session'

import { latestComments } from '@/server/comments/loader'
import { userSession } from '@/server/session'

export async function loadSidebarData(session: BlogSession) {
  const admin = userSession(session)?.role === 'admin'
  const recentComments = await latestComments()

  return { admin, recentComments }
}
