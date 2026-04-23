import type { ReactNode } from 'react'

import type { Post, PostWithMetadata, Tag } from '@/services/catalog/schema'
import type { LatestComment } from '@/services/comments/types'

import config from '@/blog.config'
import { FeaturePosts } from '@/components/page/post/FeaturePosts'
import { PostCards } from '@/components/page/post/PostCards'
import { Sidebar } from '@/components/sidebar/Sidebar'

export interface HomeLayoutBodyProps {
  posts: Post[]
  resolvedPosts: PostWithMetadata[]
  pageNum: number
  totalPage: number
  categoryLinks: Record<string, string>
  tags: Tag[]
  featureSeed: string
  admin: boolean
  recentComments: LatestComment[]
  pendingComments: LatestComment[]
  children?: ReactNode
}

// Body-region layout for the home/listing page. The route module owns the
// document shell, redirects, status handling, and SEO metadata, then passes
// a fully-computed data model in here.
export function HomeLayoutBody({
  posts,
  resolvedPosts,
  pageNum,
  totalPage,
  categoryLinks,
  tags,
  featureSeed,
  admin,
  recentComments,
  pendingComments,
  children,
}: HomeLayoutBodyProps) {
  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      {pageNum === 1 && <FeaturePosts posts={posts} seed={featureSeed} />}
      <div className="container">
        <div className="row">
          <PostCards pageNum={pageNum} posts={resolvedPosts} totalPage={totalPage} categoryLinks={categoryLinks} />
          <Sidebar
            posts={posts}
            tags={tags}
            admin={admin}
            recentComments={recentComments}
            pendingComments={pendingComments}
          />
        </div>
      </div>
      {children}
    </div>
  )
}

// Helper for page shells: compute the pagination SEO metadata inputs (title,
// prev/next, canonical) for the paginated listing.
export function computeHomeSeoProps(posts: Post[], pageNum: number) {
  const totalPage = Math.ceil(posts.length / config.settings.pagination.posts)
  const buildPageUrl = (n: number): string => (n <= 1 ? '/' : `/page/${n}`)
  return {
    pageTitle: pageNum > 1 ? `第 ${pageNum} 页` : undefined,
    canonicalUrl: buildPageUrl(pageNum),
    prevUrl: pageNum > 1 ? buildPageUrl(pageNum - 1) : undefined,
    nextUrl: pageNum < totalPage ? buildPageUrl(pageNum + 1) : undefined,
    noindex: pageNum > 1,
    totalPage,
  }
}
