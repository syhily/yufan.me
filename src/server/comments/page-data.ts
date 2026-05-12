import type { EntityTarget } from '@/server/db/target'
import type { BlogSession, SessionUser } from '@/server/session'
import type { CommentFormUser } from '@/shared/catalog'
import type { DetailPageComments } from '@/shared/comments'

import { queryLikes } from '@/server/comments/likes'
import { ensureCommentPage, loadComments, parseComments } from '@/server/comments/loader'
import { bumpPageView } from '@/server/metrics/batcher'
import { isAdmin, userSession } from '@/server/session'
import { loadSidebarData } from '@/server/sidebar/load'

// `SessionUser` already only carries id/name/email/website/admin, but the
// reply form is the only consumer in the public bundle. Projecting through
// `CommentFormUser` makes the boundary explicit so future session fields
// don't accidentally reach the SSR DOM.
function toCommentFormUser(user: SessionUser | undefined): CommentFormUser | undefined {
  if (user === undefined) {
    return undefined
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    website: user.website,
    admin: user.admin,
  }
}

export type { DetailPageComments } from '@/shared/comments'

// Comments split out so the loader can stream them via React Router's
// `<Await>` while the rest of the detail (likes, sidebar, post body)
// renders immediately. PT bodies are stored pre-rendered, so the
// per-row work in `parseComments` is now just projection — but the
// network/DB round-trip is still worth deferring.
async function loadCommentsAndItems(session: BlogSession, target: EntityTarget): Promise<DetailPageComments> {
  const commentData = await loadComments(session, target, 0, { ensurePage: false })
  const commentItems = commentData && commentData.comments.length > 0 ? await parseComments(commentData.comments) : []
  return { commentData, commentItems }
}

// "Critical" detail data: everything the page needs to paint above the fold
// (post body, likes, sidebar, current-user identity for the reply form).
// Comments are intentionally excluded so the loader can stream them
// alongside the SSR HTML.
export async function loadDetailPageCritical(
  session: BlogSession,
  target: EntityTarget,
  options?: { trackView?: boolean },
) {
  const currentUser = toCommentFormUser(userSession(session))
  const admin = isAdmin(session)
  const trackView = options?.trackView ?? true

  // Keep counting out of the critical path; this is fire-and-forget and
  // callers can disable it for non-navigation requests (e.g. prefetch).
  if (!admin && trackView) {
    bumpPageView(target)
  }

  const [metricRow, likes, sidebar] = await Promise.all([
    ensureCommentPage(target),
    queryLikes(target),
    loadSidebarData(session),
  ])

  return {
    commentKey: metricRow.publicId,
    likes,
    currentUser,
    ...sidebar,
  }
}

// Detail data with the comments promise split out, ready to stream through
// React Router's `defer`-style return + `<Await>` consumer.
export async function loadDetailPageStreaming(
  session: BlogSession,
  target: EntityTarget,
  options?: { trackView?: boolean },
) {
  const critical = await loadDetailPageCritical(session, target, options)
  const comments = loadCommentsAndItems(session, target)
  return { critical, comments }
}

// Backwards-compatible eager loader. Kept exported because
// `tests/service.comments-page-data.test.ts` exercises the parallel-fanout
// contract directly and the admin-comments listing path still wants the
// fully-resolved shape.
export async function loadDetailPageData(
  session: BlogSession,
  target: EntityTarget,
  options?: { trackView?: boolean },
) {
  const commentsPromise = loadCommentsAndItems(session, target)
  const critical = await loadDetailPageCritical(session, target, options)
  const comments = await commentsPromise
  return {
    ...critical,
    commentData: comments.commentData,
    commentItems: comments.commentItems,
  }
}
