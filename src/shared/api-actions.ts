// `API_ACTIONS` is the static manifest of every Resource Route the
// browser can call. It carries only literal strings + literal HTTP
// methods — no environment access, no DOM/Node imports — so both the
// server bundle (e.g. `server/listing.ts`'s `isCommentAction` check)
// and the client bundle (`useApiAction`/`useApiStream`) can import it.
//
// Kept under `shared/` so the import-boundary linter
// (`tests/contract.import-boundaries.test.ts`) doesn't have to
// special-case `server/* → client/*` for this purely-data manifest.
// The historical `@/client/api/actions` path is preserved as a thin
// re-export so existing client imports keep working.

export type ApiActionMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

function defineApiAction<const Route extends string, const Method extends ApiActionMethod>(
  route: Route,
  method: Method,
) {
  return {
    route,
    path: `/${route}` as const,
    method,
  }
}

export const API_ACTIONS = {
  auth: {
    // The browser sign-in flow goes through React Router's `<Form>` → route
    // `action` (see `routes/wp-login.tsx`; install can be re-added alongside
    // `routes/wp-admin.install.tsx`). The previous `auth.signIn` /
    // `auth.signUpAdmin` JSON endpoints have been removed; only mutations
    // that genuinely need a JSON channel (admin user editing) remain.
    updateUser: defineApiAction('api/actions/auth/updateUser', 'PATCH'),
  },
  comment: {
    increaseLike: defineApiAction('api/actions/comment/increaseLike', 'POST'),
    decreaseLike: defineApiAction('api/actions/comment/decreaseLike', 'DELETE'),
    validateLikeToken: defineApiAction('api/actions/comment/validateLikeToken', 'POST'),
    findAvatar: defineApiAction('api/actions/comment/findAvatar', 'POST'),
    replyComment: defineApiAction('api/actions/comment/replyComment', 'POST'),
    approve: defineApiAction('api/actions/comment/approve', 'PATCH'),
    delete: defineApiAction('api/actions/comment/delete', 'DELETE'),
    loadComments: defineApiAction('api/actions/comment/loadComments', 'GET'),
    getRaw: defineApiAction('api/actions/comment/getRaw', 'GET'),
    edit: defineApiAction('api/actions/comment/edit', 'PATCH'),
    getFilterOptions: defineApiAction('api/actions/comment/getFilterOptions', 'GET'),
    loadAll: defineApiAction('api/actions/comment/loadAll', 'POST'),
  },
  sidebar: {
    snapshot: defineApiAction('api/actions/sidebar/snapshot', 'GET'),
  },
} as const

export const API_ACTION_LIST = [
  ...Object.values(API_ACTIONS.auth),
  ...Object.values(API_ACTIONS.comment),
  ...Object.values(API_ACTIONS.sidebar),
] as const
