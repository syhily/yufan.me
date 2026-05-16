import { ORPCError, os } from '@orpc/server'

import type { Env } from '@/server/http/context'

import { hasAtLeast, type Role, type ViewerContext } from '@/server/domains/auth/rbac'

// Context every oRPC procedure sees. The Hono `/rpc/*` bridge in
// `app.ts` builds this from `c.var` after the perimeter middleware
// (session / install-gate / visitor-cookie / wp-decoy) has run.
//
// `responseHeaders` is a mutable bag the procedure can append to
// (e.g. `Set-Cookie` for csrf rotation or comment-token issuance).
// The Hono bridge merges entries onto the final `Response` after
// `RPCHandler.handle()` resolves — oRPC's RPC wire format doesn't
// have a per-procedure header channel, so this is the bridge's job.
export interface HandlerContext {
  request: Request
  session: Env['Variables']['session']
  viewer: ViewerContext | null
  clientAddress: string
  responseHeaders: Headers
}

// Subtype produced by `requireAuth` — once an auth middleware passes,
// `viewer` is guaranteed non-null. oRPC's `.use()` chaining propagates
// this narrowed context to the procedure handler automatically.
export interface AuthedHandlerContext extends Omit<HandlerContext, 'viewer'> {
  viewer: ViewerContext
}

// ─── Root procedure builder ─────────────────────────────
// `os.$context<T>()` declares the initial-context type. All four
// procedure flavours below extend from this same root so the
// `Hono → context` plumbing in `app.ts` is type-safe end-to-end.
const root = os.$context<HandlerContext>()

// ─── Middleware: require a logged-in user ───────────────
// Throws ORPCError('UNAUTHORIZED') if no session user. The Hono CSRF
// guard runs upstream of the RPCHandler bridge, so we only deal with
// auth + role logic here.
const requireAuth = root.middleware(({ context, next }) => {
  const user = context.session.get('user')
  if (!user) {
    throw new ORPCError('UNAUTHORIZED', { message: '未登录' })
  }
  return next({
    context: {
      ...context,
      viewer: { userId: user.id, role: user.role },
    } satisfies AuthedHandlerContext,
  })
})

// ─── Middleware: require role >= threshold ──────────────
function requireRole(role: Role) {
  return root.middleware(({ context, next }) => {
    const user = context.session.get('user')
    if (!user) {
      throw new ORPCError('UNAUTHORIZED', { message: '未登录' })
    }
    if (!hasAtLeast(user.role, role)) {
      throw new ORPCError('FORBIDDEN', { message: '权限不足' })
    }
    return next({
      context: {
        ...context,
        viewer: { userId: user.id, role: user.role },
      } satisfies AuthedHandlerContext,
    })
  })
}

// ─── Public base procedure ──────────────────────────────
// No auth gate. The CSRF middleware (`csrfGuard`) runs on the Hono
// layer for every `/rpc/*` mutation regardless of which base procedure
// the leaf chose — so public mutations are still CSRF-protected.
export const publicProc = root

// ─── Authed base procedure ──────────────────────────────
// Any logged-in user (admin / author / visitor). After this middleware
// resolves, `context.viewer` is typed as `ViewerContext` (non-null).
export const authedProc = root.use(requireAuth)

// ─── Role-gated base procedures ─────────────────────────
// `adminProc` is admin-only. `authorProc` requires author or admin
// (per `hasAtLeast`). Each procedure file picks one of these four
// bases and the leaf inherits the matching guard.
export const adminProc = root.use(requireRole('admin'))
export const authorProc = root.use(requireRole('author'))
