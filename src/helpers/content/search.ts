import type { DocumentData } from 'flexsearch'
import { Document } from 'flexsearch'
import { getPosts } from '@/helpers/content/schema'

interface PostItem extends DocumentData {
  title: string
  slug: string
  raw: string
  tags: string[]
}

export const index = new Document<PostItem>({
  tokenize: 'full',
  document: {
    id: 'slug',
    index: ['raw', 'title', 'tags'],
    tag: 'tags',
  },
})

for (const post of getPosts({ hidden: true, schedule: true })) {
  index.add({
    title: post.title,
    slug: post.slug,
    raw: (await post.raw()) || post.summary,
    tags: post.tags,
  })
}

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
