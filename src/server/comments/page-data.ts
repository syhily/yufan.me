import type { CommentFormUser } from '@/server/catalog'
import type { Comments as CommentsData, CommentItem } from '@/server/comments/types'
import type { BlogSession, SessionUser } from '@/server/session'

import config from '@/blog.config'
import { queryLikes } from '@/server/comments/likes'
import { ensureCommentPage, loadComments, parseComments } from '@/server/comments/loader'
import { bumpPageView } from '@/server/metrics/batcher'
import { isAdmin, userSession } from '@/server/session'
import { loadSidebarData } from '@/server/sidebar/load'
import { joinUrl } from '@/shared/urls'

// `SessionUser` already only carries id/name/email/website/admin, but the
// reply form is the only consumer in the public bundle. Projecting through
// `CommentFormUser` makes the boundary explicit so future session fields
// don't accidentally reach the SSR DOM.
function toCommentFormUser(user: SessionUser | undefined): CommentFormUser | undefined {
  if (user === undefined) return undefined
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    website: user.website,
    admin: user.admin,
  }
}

export interface DetailPageComments {
  commentData: CommentsData | null
  commentItems: CommentItem[]
}

// Comments are the slowest dependency on a typical detail page — they
// read the comment row, page row, and compile every body through the
// runtime MDX pipeline. Splitting them out lets the loader stream
// comments via React Router's `<Await>` while the rest of the detail
// (likes, sidebar, post body) renders immediately. Empty payloads
// short-circuit `compileMarkdown` so the empty-comment placeholder
// path stays free of MDX work.
async function loadCommentsAndItems(
  session: BlogSession,
  commentKey: string,
  title: string,
): Promise<DetailPageComments> {
  const commentData = await loadComments(session, commentKey, title, 0, { ensurePage: false })
  const commentItems = commentData && commentData.comments.length > 0 ? await parseComments(commentData.comments) : []
  return { commentData, commentItems }
}

// "Critical" detail data: everything the page needs to paint above the fold
// (post body, likes, sidebar, current-user identity for the reply form).
// Comments are intentionally excluded so the loader can stream them
// alongside the SSR HTML.
export async function loadDetailPageCritical(session: BlogSession, permalink: string, title: string) {
  const currentUser = toCommentFormUser(userSession(session))
  const admin = isAdmin(session)
  const commentKey = joinUrl(config.website, permalink, '/')

  // `bumpPageView` is a fire-and-forget in-memory increment (PROD-gated
  // inside the batcher) so the admin guard is the only thing left to gate
  // here. Doing this before the Promise.all keeps it strictly off the
  // critical path.
  if (!admin) bumpPageView(commentKey)

  const [, likes, sidebar] = await Promise.all([
    ensureCommentPage(commentKey, title),
    queryLikes(permalink),
    loadSidebarData(session),
  ])

  return {
    commentKey,
    likes,
    currentUser,
    ...sidebar,
  }
}

// Detail data with the comments promise split out, ready to stream through
// React Router's `defer`-style return + `<Await>` consumer.
export async function loadDetailPageStreaming(session: BlogSession, permalink: string, title: string) {
  const critical = await loadDetailPageCritical(session, permalink, title)
  const comments = loadCommentsAndItems(session, critical.commentKey, title)
  return { critical, comments }
}

// Backwards-compatible eager loader. Kept exported because
// `tests/service.comments-page-data.test.ts` exercises the parallel-fanout
// contract directly and the admin-comments listing path still wants the
// fully-resolved shape.
export async function loadDetailPageData(session: BlogSession, permalink: string, title: string) {
  const currentUser = toCommentFormUser(userSession(session))
  const admin = isAdmin(session)
  const commentKey = joinUrl(config.website, permalink, '/')

  if (!admin) bumpPageView(commentKey)

  const [, comments, likes, sidebar] = await Promise.all([
    ensureCommentPage(commentKey, title),
    loadCommentsAndItems(session, commentKey, title),
    queryLikes(permalink),
    loadSidebarData(session),
  ])

  return {
    commentKey,
    likes,
    commentData: comments.commentData,
    commentItems: comments.commentItems,
    currentUser,
    ...sidebar,
  }
}
