import type { ViewerContext } from '@/server/auth/rbac'
import type { BlogSession } from '@/server/auth/session-storage'

export type Env = {
  Variables: {
    requestId: string
    clientAddress: string
    session: BlogSession
    sessionDirty: boolean
    viewer: ViewerContext | null
  }
}
