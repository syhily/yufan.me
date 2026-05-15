import type { ViewerContext } from '@/server/auth/rbac'
import type { BlogSession } from '@/server/session'

export type Env = {
  Variables: {
    requestId: string
    clientAddress: string
    session: BlogSession
    sessionDirty: boolean
    viewer: ViewerContext | null
  }
}
