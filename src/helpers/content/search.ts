import type { DocumentData } from 'flexsearch'
import { REDIS_URL } from 'astro:env/server'
import { Document } from 'flexsearch'
import Database from 'flexsearch/db/redis'
import { createClient } from 'redis'
import { formatLocalDate } from '@/helpers/content/formatter'
import { getPosts } from '@/helpers/content/schema'

interface PostItem extends DocumentData {
  title: string
  slug: string
  raw: string
  tags: string[]
  updated: string
}

// Create indexes on top of Redis database
const redis = await createClient({ url: REDIS_URL }).connect()
const database = new Database('posts-search-indexes', { db: redis })
const index = new Document<PostItem, WorkerType, Database>({
  tokenize: 'full',
  document: {
    id: 'slug',
    index: ['raw', 'title', 'tags'],
    tag: 'tags',
  },
})
await index.mount(database)

// Start indexing posts
for (const post of getPosts({ hidden: true, schedule: true })) {
  const existPost = await index.get(post.slug)
  const updateDate = formatLocalDate(post.updated ?? new Date())

  if (existPost !== null) {
    if (existPost.updated !== updateDate) {
      await index.update({
        title: post.title,
        slug: post.slug,
        raw: (await post.raw()) || post.summary,
        tags: post.tags,
        updated: updateDate,
      })
    }
  }
  else {
    await index.add({
      title: post.title,
      slug: post.slug,
      raw: (await post.raw()) || post.summary,
      tags: post.tags,
      updated: updateDate,
    })
  }
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
  const ids = (await index.search(query)).flatMap(({ result }) => result.map(id => id.toString()))
  const totalHits = [...new Set(ids)]
  return {
    hits: totalHits.slice(offset, offset + limit),
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(totalHits.length / limit),
  }
}
