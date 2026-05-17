/**
 * @deprecated This barrel file is preserved only for test compatibility.
 * Production code uses direct imports from `@/server/domains/auth/*`.
 *
 * TODO: Rewrite the test mocks below to target individual modules and
 * then delete this file:
 *   - tests/route.{listing,detail,wp-decoy,archives,page-detail-*,home}.test.ts
 *   - tests/service.{auth,auth-flow,auth-sessions}.test.ts
 *   - tests/route.wp-login{,-reset}.test.ts
 *   - tests/service.cms-pages.test.ts (if it still imports `@/server/session`)
 */

export type { BlogSession, BlogSessionData, SessionUser } from '@/server/domains/auth/session-storage'
export { commitSession, destroySession, getRequestSession, getSession } from '@/server/domains/auth/session-storage'

export type { SessionContext } from '@/server/domains/auth/primitives'
export {
  establishLoginSession,
  login,
  logout,
  resolveSessionContext,
  userSession,
} from '@/server/domains/auth/primitives'
export { hasAtLeast, requireRole, type Role, type ViewerContext } from '@/server/domains/auth/rbac'

export type { IssuedCsrfToken, ReusedCsrfToken } from '@/server/domains/auth/csrf'
export { clearCsrfCookie, issueCsrfToken, reuseOrIssueCsrfToken, validateRequestCsrf } from '@/server/domains/auth/csrf'

export type { RequestContextValue, RouteRequestContext } from '@/server/domains/auth/context'
export {
  getRouteRequestContext,
  requestContext,
  sessionContext,
  tryGetRequestContext,
  tryGetSessionContext,
} from '@/server/domains/auth/context'

export type { AuthFlowResult, InstallWizardSeed, SignUpAdminSeed } from '@/server/domains/auth/flows'
export {
  processAuthFormSubmission,
  seedInstallSettingsWithSession,
  signInWithSession,
  signUpInitialAdminWithSession,
} from '@/server/domains/auth/flows'
