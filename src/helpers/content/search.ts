import type { DocumentData } from 'flexsearch'
import { Document } from 'flexsearch'
import { posts } from '@/helpers/content/schema'

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

for (const post of posts) {
  index.add({
    title: post.title,
    slug: post.slug,
    // eslint-disable-next-line antfu/no-top-level-await
    raw: (await post.raw()) || post.summary,
    tags: post.tags,
  })
}

export function searchPosts(query: string): string[] {
  const ids = index.search(query).flatMap(({ result }) => result.map(id => id.toString()))
  return [...new Set(ids)]
}
