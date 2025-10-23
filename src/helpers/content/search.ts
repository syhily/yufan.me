import type { DocumentData } from 'flexsearch'
import { Document } from 'flexsearch'
import { getPosts } from '@/helpers/content/schema'

interface PostItem extends DocumentData {
  title: string
  slug: string
  raw: string
  tags: string[]
}

const index = new Document<PostItem>({
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

export function searchPosts(query: string): string[] {
  const ids = index.search(query).flatMap(({ result }) => result.map(id => id.toString()))
  return [...new Set(ids)]
}
