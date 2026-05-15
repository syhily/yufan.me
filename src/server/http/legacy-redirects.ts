// Explicit redirect table for the legacy `/api/actions/*` URLs that
// the descriptor era exposed before the ts-rest migration. Each row
// maps `/api/actions/<legacy>` → the canonical REST URL on the new
// contract tree.
//
// Why a table and not a regex:
//   The old descriptors used camelCase action names
//   (`/api/actions/admin/listUsers`); the new contracts use
//   resource-style paths (`/api/admin/users`). The two don't share
//   a syntactic transform — any regex / kebab-case rewrite would
//   land on URLs that don't exist on the new tree, so we keep an
//   explicit two-column source of truth.
//
// Lifecycle:
//   - Hits SHOULD fall to 0 within 30 days of release. The
//     adapter logs each redirect with a `legacy-redirect` scope so
//     ops can watch the trend in dashboards.
//   - When the hit rate drops below a threshold (1 req / day), the
//     route handler can be removed and all entries below cleaned up
//     in one PR (finalization Plan §F4.2 follow-up).
//
// Unknown legacy paths return 410 Gone — preferable to a 404 since
// the wire signals "this used to exist; refresh your client".

interface LegacyRedirect {
  /** Path or path prefix that came in on `/api/actions/`. */
  legacy: string
  /** New canonical path (no `/api` prefix is added; spell it fully). */
  target: string
  /** Default 301. Use 308 if `method !== GET` matters for clients. */
  status?: 301 | 308
}

// Static rewrite table. List leaf endpoints first; prefix matches
// last. Path params (`/:id`) are matched lexically — the caller
// passes the raw URL pathname through `findLegacyRedirect()` so the
// trailing segment is preserved.
const STATIC_MAP: LegacyRedirect[] = [
  // ── admin/users ────────────────────────────────────
  { legacy: '/admin/listUsers', target: '/api/admin/users' },
  { legacy: '/admin/inviteAuthor', target: '/api/admin/users/invite' },
  { legacy: '/admin/sendPasswordReset', target: '/api/admin/users/password-reset' },
  { legacy: '/admin/revokeSession', target: '/api/admin/users/revoke-session' },
  { legacy: '/admin/revokeUserSessions', target: '/api/admin/users/revoke-all-sessions' },
  { legacy: '/admin/bulkApproveUserComments', target: '/api/admin/users/bulk-approve-comments' },
  { legacy: '/admin/bulkSoftDeleteUserComments', target: '/api/admin/users/bulk-delete-comments' },

  // ── admin/categories ───────────────────────────────
  { legacy: '/admin/listCategories', target: '/api/admin/categories' },
  { legacy: '/admin/upsertCategory', target: '/api/admin/categories' },
  { legacy: '/admin/reorderCategories', target: '/api/admin/categories/reorder' },

  // ── admin/tags ─────────────────────────────────────
  { legacy: '/admin/listTags', target: '/api/admin/tags' },
  { legacy: '/admin/upsertTag', target: '/api/admin/tags' },

  // ── admin/friends ──────────────────────────────────
  { legacy: '/admin/listFriends', target: '/api/admin/friends' },
  { legacy: '/admin/upsertFriend', target: '/api/admin/friends' },

  // ── admin/images ───────────────────────────────────
  { legacy: '/admin/listImages', target: '/api/admin/images' },
  { legacy: '/admin/recalculateImageThumbhash', target: '/api/admin/images/recalculate-thumbhash' },
  { legacy: '/admin/uploadImage', target: '/api/admin/images/upload' },

  // ── admin/music ────────────────────────────────────
  { legacy: '/admin/listMusic', target: '/api/admin/musics' },
  { legacy: '/admin/searchMusic', target: '/api/admin/musics/search' },
  { legacy: '/admin/addMusic', target: '/api/admin/musics' },

  // ── admin/posts ────────────────────────────────────
  { legacy: '/admin/listPosts', target: '/api/admin/posts' },
  { legacy: '/admin/unpublishPost', target: '/api/admin/posts/unpublish' },
  { legacy: '/admin/savePostDraft', target: '/api/admin/posts/draft' },
  { legacy: '/admin/publishPostLatest', target: '/api/admin/posts/publish' },
  { legacy: '/admin/previewPost', target: '/api/admin/posts/preview' },
  { legacy: '/admin/upsertPostMeta', target: '/api/admin/posts/meta' },
  { legacy: '/admin/listPostRevisions', target: '/api/admin/posts/revisions' },

  // ── admin/pages ────────────────────────────────────
  { legacy: '/admin/listPages', target: '/api/admin/pages' },
  { legacy: '/admin/unpublishPage', target: '/api/admin/pages/unpublish' },
  { legacy: '/admin/savePageDraft', target: '/api/admin/pages/draft' },
  { legacy: '/admin/publishPageLatest', target: '/api/admin/pages/publish' },
  { legacy: '/admin/previewPage', target: '/api/admin/pages/preview' },
  { legacy: '/admin/upsertPageMeta', target: '/api/admin/pages/meta' },
  { legacy: '/admin/listPageRevisions', target: '/api/admin/pages/revisions' },

  // ── admin/settings, cache, mail, renders ───────────
  { legacy: '/admin/getSettings', target: '/api/admin/settings' },
  { legacy: '/admin/updateSettings', target: '/api/admin/settings' },
  { legacy: '/admin/clearCache', target: '/api/admin/cache/clear' },
  { legacy: '/admin/sendTestMail', target: '/api/admin/mail/test' },
  { legacy: '/admin/renderMath', target: '/api/admin/renders/math' },
  { legacy: '/admin/renderMermaid', target: '/api/admin/renders/mermaid' },
  { legacy: '/admin/reindexSearch', target: '/api/admin/renders/reindex-search' },

  // ── public surfaces ────────────────────────────────
  { legacy: '/comment/comments', target: '/api/comment/comments' },
  { legacy: '/comment/likes', target: '/api/comment/likes' },
  { legacy: '/comment/avatar', target: '/api/comment/avatar' },
  { legacy: '/account/profile', target: '/api/account/profile' },
  { legacy: '/account/password', target: '/api/account/password' },
  { legacy: '/image/resolveThumbhash', target: '/api/image/thumbhash' },
  { legacy: '/music/get', target: '/api/music/get' },
]

/**
 * Match a legacy pathname against the rewrite table. Returns the
 * canonical target plus the parametric tail (the part after the
 * legacy prefix, if any) so callers can reattach `/<id>` segments
 * like `/admin/users/123/restore`.
 *
 * Returns `null` when the path is not recognised — caller should
 * respond `410 Gone`.
 */
export function findLegacyRedirect(pathname: string): {
  target: string
  status: 301 | 308
} | null {
  const stripped = pathname.replace(/^\/api\/actions/, '')
  const entry = STATIC_MAP.find((e) => stripped === e.legacy || stripped.startsWith(`${e.legacy}/`))
  if (!entry) {
    return null
  }
  const tail = stripped.slice(entry.legacy.length)
  return { target: `${entry.target}${tail}`, status: entry.status ?? 301 }
}
