import type { ViewerContext } from '@/server/domains/auth/rbac'
import type { BlogSession } from '@/server/domains/auth/session-storage'

export type Env = {
  Variables: {
    requestId: string
    clientAddress: string
    session: BlogSession
    sessionDirty: boolean
    viewer: ViewerContext | null
  }
}
