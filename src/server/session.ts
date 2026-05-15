/**
 * @deprecated This barrel file is preserved only for test compatibility.
 * All production source files have been migrated to direct imports.
 * Do not add new imports here — import from the concrete source modules
 * under `@/server/auth/*` instead.
 *
 * TODO: Remove once test mocks are rewritten to target individual modules.
 */

export type { BlogSession, BlogSessionData, SessionUser } from '@/server/auth/session-storage'
export { commitSession, destroySession, getRequestSession, getSession } from '@/server/auth/session-storage'

export type { SessionContext } from '@/server/auth/primitives'
export { establishLoginSession, login, logout, resolveSessionContext, userSession } from '@/server/auth/primitives'
export { hasAtLeast, requireRole, type Role, type ViewerContext } from '@/server/auth/rbac'

export type { IssuedCsrfToken, ReusedCsrfToken } from '@/server/auth/csrf'
export { clearCsrfCookie, issueCsrfToken, reuseOrIssueCsrfToken, validateRequestCsrf } from '@/server/auth/csrf'

export type { RequestContextValue, RouteRequestContext } from '@/server/auth/context'
export {
  getRouteRequestContext,
  requestContext,
  sessionContext,
  tryGetRequestContext,
  tryGetSessionContext,
} from '@/server/auth/context'

export type { AuthFlowResult, InstallSettingsSeed, SignUpAdminSeed } from '@/server/auth/flows'
export {
  processAuthFormSubmission,
  seedInstallSettingsWithSession,
  signInWithSession,
  signUpInitialAdminWithSession,
} from '@/server/auth/flows'
