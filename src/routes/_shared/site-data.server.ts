import { DateTime } from 'luxon'

import type { BlogSession } from '@/services/auth/session.server'
import type { Post } from '@/services/catalog/schema'

import config from '@/blog.config'
import { isAdmin, userSession } from '@/services/auth/session.server'
import { getCategory, getPosts, getPostsWithMetadata, getTags } from '@/services/catalog/schema.server'
import { queryLikes } from '@/services/comments/likes.server'
import {
  latestComments,
  loadComments,
  parseComments,
  pendingComments as loadPendingComments,
} from '@/services/comments/loader.server'
import { slicePosts } from '@/services/markdown/formatter'

export async function loadSidebarData(session: BlogSession | null) {
  const admin = isAdmin(session)
  const [recentComments, pendingComments] = await Promise.all([
    latestComments(),
    admin ? loadPendingComments() : Promise.resolve([]),
  ])

  return { admin, recentComments, pendingComments }
}

export async function loadHomeListing(posts: Post[], pageNum: number) {
  const { currentPosts, totalPage } = slicePosts(posts, pageNum, config.settings.pagination.posts)
  const resolvedPosts = await getPostsWithMetadata(currentPosts, {
    likes: true,
    views: true,
    comments: true,
  })

  const categoryLinks = Object.fromEntries(
    await Promise.all(
      Array.from(new Set(resolvedPosts.map((post) => post.category))).map(async (category) => {
        const value = await getCategory(category, undefined)
        return [category, value?.permalink ?? ''] as const
      }),
    ),
  )

  const tags = await getTags()
  const featureSeed = DateTime.now().setZone(config.settings.timeZone).toFormat('yyyy-MM-dd')
  return { resolvedPosts, totalPage, categoryLinks, tags, featureSeed }
}

export async function loadPostListing(
  posts: Post[],
  pageNum: number,
  pageSize: number = config.settings.pagination.posts,
) {
  const { currentPosts, totalPage } = slicePosts(posts, pageNum, pageSize)
  const resolvedPosts = await getPostsWithMetadata(currentPosts, {
    likes: true,
    views: true,
    comments: false,
  })

  return { resolvedPosts, totalPage }
}

export async function loadDetailPageData(session: BlogSession | null, commentKey: string, title: string) {
  const currentUser = userSession(session)
  const admin = isAdmin(session)
  const commentsPromise = loadComments(session, commentKey, title, 0)

  const [likes, commentData, commentItems, sidebarPosts, tags, sidebar] = await Promise.all([
    queryLikes(commentKey.replace(config.website, '').replace(/\/$/, '')),
    commentsPromise,
    commentsPromise.then(async (comments) => (comments ? parseComments(comments.comments) : [])),
    getPosts({ hidden: false, schedule: false }),
    getTags(),
    loadSidebarData(session),
  ])

  if (!admin) {
    const { increaseViews } = await import('@/services/comments/loader.server')
    await increaseViews(commentKey, title)
  }

  return {
    likes,
    commentData,
    commentItems,
    currentUser,
    sidebarPosts,
    tags,
    ...sidebar,
  }
}
