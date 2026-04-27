import type { ListingPostCardWithMetadata } from '@/server/catalog'

import { groupBy } from '@/shared/tools'
import { PostSquare } from '@/ui/post/post/ListingLayout'
import { Container } from '@/ui/primitives/Container'
import { Heading } from '@/ui/primitives/Heading'

export interface ArchivesBodyProps {
  resolvedPosts: ListingPostCardWithMetadata[]
}

export function ArchivesBody({ resolvedPosts }: ArchivesBodyProps) {
  const groupedPosts = groupBy(resolvedPosts, (post) => {
    const date = new Date(post.date)
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`
  })

  return (
    <div className="lg:px-2 2xl:px-5 py-3 md:py-4 2xl:py-5">
      <Container>
        <div className="mb-3 lg:mb-4">
          <Heading level={1}>共 {resolvedPosts.length} 篇文章</Heading>
        </div>
      </Container>
      {Object.entries(groupedPosts).map(([key, posts]) => (
        <Container key={key}>
          <div className="mb-5">
            <div className="mb-3 lg:mb-4">
              <Heading level={2}>{key}</Heading>
              <div className="text-foreground-muted mt-1">本月累计 {posts.length} 篇</div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 xl:grid-cols-4 2xl:gap-4">
              {posts.map((post, i) => (
                <PostSquare key={post.slug} post={post} first={i === 0} />
              ))}
            </div>
          </div>
        </Container>
      ))}
    </div>
  )
}
