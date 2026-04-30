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
    // The browser sign-in / sign-up flows go directly through React Router's
    // `<Form>` → route `action` (see `routes/wp-login.tsx` and
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
    searchPages: defineApiAction('api/actions/comment/searchPages', 'GET'),
    searchAuthors: defineApiAction('api/actions/comment/searchAuthors', 'GET'),
    loadAll: defineApiAction('api/actions/comment/loadAll', 'POST'),
  },
  admin: {
    // Admin-only user-management endpoints consumed by the wp-admin SPA.
    // Each is gated by `requireAdmin: true` in its `defineApiAction(...)`
    // block, so even a hand-crafted request without an admin session is
    // rejected with a 403 at the perimeter.
    listUsers: defineApiAction('api/actions/admin/listUsers', 'GET'),
    getUser: defineApiAction('api/actions/admin/getUser', 'POST'),
    softDeleteUser: defineApiAction('api/actions/admin/softDeleteUser', 'DELETE'),
    restoreUser: defineApiAction('api/actions/admin/restoreUser', 'POST'),
    muteUser: defineApiAction('api/actions/admin/muteUser', 'PATCH'),
    bulkApproveUserComments: defineApiAction('api/actions/admin/bulkApproveUserComments', 'POST'),
    bulkSoftDeleteUserComments: defineApiAction('api/actions/admin/bulkSoftDeleteUserComments', 'DELETE'),
    // Admin settings panel — read snapshot, write a section-scoped patch,
    // or drop a section back to the seed defaults. Each gated by
    // `requireAdmin: true` in the corresponding `defineApiAction(...)`.
    getSettings: defineApiAction('api/actions/admin/getSettings', 'GET'),
    updateSettings: defineApiAction('api/actions/admin/updateSettings', 'PATCH'),
    resetSettings: defineApiAction('api/actions/admin/resetSettings', 'POST'),
    // Admin cache panel — list registered Redis buckets with current
    // key counts, and clear a single bucket (or all of them) via SCAN +
    // UNLINK. Same `requireAdmin: true` perimeter as everything else
    // in this group.
    getCacheStats: defineApiAction('api/actions/admin/getCacheStats', 'GET'),
    clearCache: defineApiAction('api/actions/admin/clearCache', 'POST'),
    // Admin mail panel — fire a one-off test email through the live
    // settings to verify the Zeabur connection before flipping the
    // public toggle.
    sendTestMail: defineApiAction('api/actions/admin/sendTestMail', 'POST'),
  },
} as const

export const API_ACTION_LIST = [
  ...Object.values(API_ACTIONS.auth),
  ...Object.values(API_ACTIONS.comment),
  ...Object.values(API_ACTIONS.admin),
] as const
