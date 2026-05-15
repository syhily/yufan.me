import 'react-router'
import type { ViewerContext } from '@/server/auth/rbac'
import type { BlogSession } from '@/server/session'

declare module 'react-router' {
  interface Future {
    v8_middleware: true
  }

  interface AppLoadContext {
    session: BlogSession
    viewer: ViewerContext | null
    clientAddress: string
    user?: import('@/server/auth/primitives').SessionUser
    role: import('@/shared/roles').Role | null
    url: URL
  }
}
