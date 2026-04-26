import type { CommentFormUser } from '@/server/catalog'
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

export async function loadDetailPageData(session: BlogSession, permalink: string, title: string) {
  const currentUser = toCommentFormUser(userSession(session))
  const admin = isAdmin(session)
  const commentKey = joinUrl(config.website, permalink, '/')

  // Fan out every independent read. `loadComments` chains directly into
  // `parseComments` (the marked/MDX pass) so that the comment markdown parsing
  // overlaps with the sidebar / likes queries instead of running serially
  // after them. Empty comment payloads short-circuit the marked round-trip
  // through `parseContent` for every `"该留言内容为空"` placeholder.
  const commentsAndItems = (async () => {
    const commentData = await loadComments(session, commentKey, title, 0, { ensurePage: false })
    const commentItems = commentData && commentData.comments.length > 0 ? await parseComments(commentData.comments) : []
    return { commentData, commentItems }
  })()

  // `bumpPageView` is a fire-and-forget in-memory increment (PROD-gated
  // inside the batcher) so the admin guard is the only thing left to gate
  // here. Doing this before the Promise.all keeps it strictly off the
  // critical path.
  if (!admin) bumpPageView(commentKey)

  const [, { commentData, commentItems }, likes, sidebar] = await Promise.all([
    ensureCommentPage(commentKey, title),
    commentsAndItems,
    queryLikes(permalink),
    loadSidebarData(session),
  ])

  return {
    commentKey,
    likes,
    commentData,
    commentItems,
    currentUser,
    ...sidebar,
  }
}
