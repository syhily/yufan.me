import type { LoadPostsWithMetadataOptions, Post, PostWithMetadata } from '@/services/catalog/schema'

export * from '@/services/catalog/schema'

export async function getPostsWithMetadata(
  posts: Post[],
  options: LoadPostsWithMetadataOptions,
): Promise<PostWithMetadata[]> {
  if (posts.length === 0) {
    return []
  }

  const { queryMetadata } = await import('@/services/comments/likes.server')
  const metas = await queryMetadata(
    posts.map((post) => post.permalink),
    options,
  )
  return posts.map((post) => {
    const meta = metas.get(post.permalink) ?? { likes: 0, views: 0, comments: 0 }
    return { ...post, meta }
  })
}
