import type { AstroSession } from 'astro'
import type { ReactNode } from 'react'

import type { Post, Tag } from '@/services/catalog/schema'

import config from '@/blog.config'
import { FeaturePosts } from '@/components/page/post/FeaturePosts'
import { PostCards } from '@/components/page/post/PostCards'
import { Sidebar } from '@/components/sidebar/Sidebar'

export interface HomeLayoutBodyProps {
  posts: Post[]
  pageNum: number
  tags: Tag[]
  session: AstroSession | undefined
  children?: ReactNode
}

// Body-region layout for the home/listing page. The surrounding `<html>` /
// `<head>` document + SEO meta live in the `.astro` page shell so Astro-only
// APIs (`Astro.redirect`, `Astro.response`, named slot forwarding for `<head>`)
// stay where they can actually run.
export function HomeLayoutBody({ posts, pageNum, tags, session, children }: HomeLayoutBodyProps) {
  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      {pageNum === 1 && <FeaturePosts posts={posts} />}
      <div className="container">
        <div className="row">
          <PostCards pageNum={pageNum} posts={posts} />
          <Sidebar posts={posts} tags={tags} session={session} />
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
