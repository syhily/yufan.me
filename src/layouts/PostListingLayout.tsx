import type { PostWithMetadata } from '@/services/catalog/schema'

import { Pagination } from '@/components/page/pagination/Pagination'
import { PostSquare } from '@/components/page/post/PostSquare'

export interface PostListingBodyProps {
  title: string
  description?: string
  resolvedPosts: PostWithMetadata[]
  pageNum: number
  totalPage: number
  rootPath: string
  alwaysRenderPagination?: boolean
}

// Body-region view for the PostListingLayout shell. The shell handles all
// Astro-only concerns (redirect-on-underflow, rewrite-to-404 on empty, post
// metadata fetching, SEO meta) and passes a fully-resolved post list in.
export function PostListingBody({
  title,
  description,
  resolvedPosts,
  pageNum,
  totalPage,
  rootPath,
  alwaysRenderPagination = true,
}: PostListingBodyProps) {
  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      <div className="container">
        <div className="mb-3 mb-lg-4">
          <h1>{title}</h1>
          {description && (
            <div className="text-muted mt-1">
              <span dangerouslySetInnerHTML={{ __html: description }} />
            </div>
          )}
        </div>
        {resolvedPosts.length === 0 ? (
          <div className="data-null">
            <div className="my-auto">
              <h1 className="font-number">404</h1>
              <div>抱歉，没有你要找的内容...</div>
            </div>
          </div>
        ) : (
          <>
            <div className="row g-2 g-md-3 g-xxl-4 list-grouped">
              {resolvedPosts.map((post, index) => (
                <PostSquare key={post.slug} post={post} first={index === 0} />
              ))}
            </div>
            {(alwaysRenderPagination || totalPage > 1) && (
              <div className="mt-4 mt-lg-5">
                <Pagination current={pageNum} total={totalPage} rootPath={rootPath} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export interface PostListingSeoProps {
  title: string
  pageNum: number
  totalPage: number
  rootPath: string
  forceNoindex?: boolean
}

export function computePostListingSeoProps({
  title,
  pageNum,
  totalPage,
  rootPath,
  forceNoindex = false,
}: PostListingSeoProps) {
  const pageRoot = rootPath.endsWith('/') ? rootPath : `${rootPath}/`
  const buildPageUrl = (n: number): string => (n <= 1 ? rootPath : `${pageRoot}page/${n}`)
  return {
    pageTitle: pageNum > 1 ? `${title} · 第 ${pageNum} 页` : title,
    canonicalUrl: buildPageUrl(pageNum),
    prevUrl: pageNum > 1 ? buildPageUrl(pageNum - 1) : undefined,
    nextUrl: pageNum < totalPage ? buildPageUrl(pageNum + 1) : undefined,
    noindex: forceNoindex || pageNum > 1,
  }
}
