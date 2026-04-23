import type { PostWithMetadata } from '@/services/catalog/schema'

import { PostSquare } from '@/components/page/post/PostSquare'
import { groupBy } from '@/shared/tools'

export interface ArchivesBodyProps {
  resolvedPosts: PostWithMetadata[]
}

export function ArchivesBody({ resolvedPosts }: ArchivesBodyProps) {
  const groupedPosts = groupBy(resolvedPosts, (post) => {
    const date = new Date(post.date)
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`
  })

  return (
    <div className="px-lg-2 px-xxl-5 py-3 py-md-4 py-xxl-5">
      <div className="container">
        <div className="mb-3 mb-lg-4">
          <h1>共 {resolvedPosts.length} 篇文章</h1>
        </div>
      </div>
      {Object.entries(groupedPosts).map(([key, posts]) => (
        <div key={key} className="container">
          <div className="mb-5">
            <div className="mb-3 mb-lg-4">
              <h2>{key}</h2>
              <div className="text-muted mt-1">本月累计 {posts.length} 篇</div>
            </div>
            <div className="row g-2 g-md-3 g-xxl-4 list-grouped">
              {posts.map((post, i) => (
                <PostSquare key={post.slug} post={post} first={i === 0} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
