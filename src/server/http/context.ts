// Per-request Hono context variables.
//
// All middleware (`requestId`, `clientAddress`, session, install-gate,
// CSRF, rate-limit) and all controllers reach into `c.var.*` for
// session / viewer / IP. Keeping the type centralised here means
// adding a new variable is a single-file change.
//
// Phase A1 spike: only the minimal set needed by `account/updateProfile`
// + `ts-rest-adapter` is declared. Later phases extend this.

import type { ViewerContext } from '@/server/auth/rbac'
import type { BlogSession } from '@/server/session'

export interface RequestContextVariables {
  requestId: string
  clientAddress: string
  session: BlogSession
  sessionDirty: boolean
  viewer: ViewerContext | null
}

export type Env = {
  Variables: RequestContextVariables
}
