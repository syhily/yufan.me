import { eq, sql } from 'drizzle-orm'

import type { PortableTextBody } from '@/shared/pt/schema'

import { db } from '@/server/db/pool'
import { postSearchIndex } from '@/server/db/schema'
import { getLogger } from '@/server/logger'
import { bodyToPlainText } from '@/shared/pt/schema'

import { generateEmbedding } from './openai'

export async function indexPost(postId: bigint, title: string, summary: string, body: PortableTextBody): Promise<void> {
  const plainText = bodyToPlainText(body)
  const indexText = `${title}\n${summary}\n${plainText}`.trim()

  const embedding = await generateEmbedding(indexText)

  getLogger('search.indexer').info('Embedding generated', {
    postId: String(postId),
    hasEmbedding: embedding !== null,
    dimensions: embedding?.length ?? 0,
  })

  await db
    .insert(postSearchIndex)
    .values({
      postId,
      plainText,
      embedding: embedding ?? sql`NULL`,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: postSearchIndex.postId,
      set: {
        plainText,
        embedding: embedding ?? sql`NULL`,
        updatedAt: new Date(),
      },
    })
}

export async function removePostIndex(postId: bigint): Promise<void> {
  await db.delete(postSearchIndex).where(eq(postSearchIndex.postId, postId))
}
