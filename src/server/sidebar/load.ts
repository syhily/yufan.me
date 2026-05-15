import type { BlogSession } from '@/server/auth/session-storage'

import { userSession } from '@/server/auth/primitives'
import { latestComments } from '@/server/comments/loader'

export async function loadSidebarData(session: BlogSession) {
  const admin = userSession(session)?.role === 'admin'
  const recentComments = await latestComments()

  return { admin, recentComments }
}
