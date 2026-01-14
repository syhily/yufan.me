import type { DocumentData } from 'flexsearch'
import { Document } from 'flexsearch'
import { getPosts } from '@/helpers/content/schema'

interface PostItem extends DocumentData {
  title: string
  slug: string
  raw: string
  tags: string[]
}

// Create indexes on top of Redis database
const index = new Document<PostItem>({
  tokenize: 'full',
  document: {
    id: 'slug',
    index: ['title', 'tags'],
    tag: 'tags',
  },
})

// Start indexing posts
await Promise.all(getPosts({ hidden: true, schedule: true }).map(async (post) => {
  index.add({
    title: post.title,
    slug: post.slug,
    raw: post.summary,
    tags: post.tags,
  })
}))

export async function searchPosts(
  query: string,
  limit: number,
  offset: number = 0,
): Promise<{
  hits: string[]
  page: number
  totalPages: number
}> {
  const ids = index.search(query).flatMap(({ result }) => result.map(id => id.toString()))
  const totalHits = [...new Set(ids)]
  return {
    hits: totalHits.slice(offset, offset + limit),
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(totalHits.length / limit),
  }
}
