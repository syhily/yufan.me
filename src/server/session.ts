export type { BlogSession, BlogSessionData, SessionUser } from '@/server/auth/session-storage'
export { commitSession, destroySession, getRequestSession, getSession } from '@/server/auth/session-storage'

export type { SessionContext } from '@/server/auth/primitives'
export { isAdmin, login, logout, resolveSessionContext, userSession } from '@/server/auth/primitives'

export type { IssuedCsrfToken } from '@/server/auth/csrf'
export { clearCsrfCookie, issueCsrfToken, validateRequestCsrf } from '@/server/auth/csrf'

export type { RequestContextValue, RouteRequestContext } from '@/server/auth/context'
export {
  getRouteRequestContext,
  requestContext,
  sessionContext,
  tryGetRequestContext,
  tryGetSessionContext,
} from '@/server/auth/context'

export { sessionMiddleware } from '@/server/middleware/session'

export type { AuthFlowResult, InstallSettingsSeed, SignUpAdminSeed } from '@/server/auth/flows'
export {
  processAuthFormSubmission,
  seedInstallSettingsWithSession,
  signInWithSession,
  signUpInitialAdminWithSession,
} from '@/server/auth/flows'
