import type { MetaDescriptor } from 'react-router'

import { pagePath } from '@/server/route-helpers/paths'
import { routeMeta } from '@/server/seo/meta'

export interface ListingSeoProps {
  title?: string
  description?: string
  pageNum: number
  totalPage: number
  rootPath: string
  forceNoindex?: boolean
}

// Produces the **complete** `MetaDescriptor[]` for a listing page in one
// call so loaders can ship the final tags over the wire. Each route's
// `meta()` then becomes a one-liner that returns `loaderData?.seo ?? routeMeta()`,
// avoiding the previous double-projection through a `ListingSeoPayload`
// shape (and the routeMeta call duplicated in every meta function).
export function listingSeo({
  title,
  description,
  pageNum,
  totalPage,
  rootPath,
  forceNoindex = false,
}: ListingSeoProps): MetaDescriptor[] {
  let pageTitle = title
  if (pageNum > 1) {
    pageTitle = title === undefined ? `第 ${pageNum} 页` : `${title} · 第 ${pageNum} 页`
  }

  return routeMeta({
    title: pageTitle,
    description,
    pageUrl: pagePath(rootPath, pageNum),
    canonical: true,
    prevUrl: pageNum > 1 ? pagePath(rootPath, pageNum - 1) : undefined,
    nextUrl: pageNum < totalPage ? pagePath(rootPath, pageNum + 1) : undefined,
    noindex: forceNoindex || pageNum > 1,
  })
}
