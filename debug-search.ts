process.loadEnvFile('.env')

import { eq, sql, cosineDistance, desc, and, gt, isNull, count } from 'drizzle-orm'

import { db } from './src/server/db/pool'
import { post, postSearchIndex } from './src/server/db/schema'
import { generateEmbedding } from './src/server/search/openai'
import { hydrateBlogSettings } from './src/server/settings/snapshot'
async function main() {
  await hydrateBlogSettings()
  const query = process.argv[2] || '喜欢的文章'
  const rawThreshold = process.argv.find((a) => a.match(/^\d+(\.\d+)?$/))
  const threshold = rawThreshold !== undefined ? Number(rawThreshold) : 0.7

  console.log('=== Diagnostic ===')
  console.log('Query:', query)
  console.log('Threshold:', threshold)

  // 1. Check if post_search_index has data
  const indexCount = await db.select({ count: count() }).from(postSearchIndex)
  console.log('\n1. post_search_index row count:', indexCount[0].count)

  const sample = await db
    .select({ postId: postSearchIndex.postId, hasEmbedding: sql<boolean>`${postSearchIndex.embedding} IS NOT NULL` })
    .from(postSearchIndex)
    .limit(3)
  console.log('   Sample rows:', sample)

  // 2. Generate embedding
  const embedding = await generateEmbedding(query)
  if (!embedding) {
    console.log('\n2. FAILED to generate embedding')
    return
  }
  console.log('\n2. Embedding generated, dimensions:', embedding.length)

  // 3. Test the CURRENT query (Drizzle cosineDistance)
  const similarity = sql<number>`1 - (${cosineDistance(postSearchIndex.embedding, embedding)})`
  const rowsCurrent = await db
    .select({ slug: post.slug, similarity })
    .from(post)
    .leftJoin(postSearchIndex, eq(post.id, postSearchIndex.postId))
    .where(and(isNull(post.deletedAt), eq(post.published, true), gt(similarity, threshold)))
    .orderBy(desc(similarity))
    .limit(10)

  console.log('\n3. CURRENT query (drizzle cosineDistance) results:', rowsCurrent.length)
  if (rowsCurrent.length > 0) {
    console.log('   Top result:', rowsCurrent[0])
  }

  // 4. Test with explicit ::vector cast
  const similarityFixed = sql<number>`1 - (${postSearchIndex.embedding} <=> ${JSON.stringify(embedding)}::vector)`
  const rowsFixed = await db
    .select({ slug: post.slug, similarity: similarityFixed })
    .from(post)
    .leftJoin(postSearchIndex, eq(post.id, postSearchIndex.postId))
    .where(and(isNull(post.deletedAt), eq(post.published, true), gt(similarityFixed, threshold)))
    .orderBy(desc(similarityFixed))
    .limit(10)

  console.log('\n4. FIXED query (explicit ::vector) results:', rowsFixed.length)
  if (rowsFixed.length > 0) {
    console.log('   Top result:', rowsFixed[0])
  }

  // 5. Test raw SQL directly against post_search_index only
  const rawRows = await db.execute(sql`
    SELECT p.slug, 1 - (psi.embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
    FROM post p
    LEFT JOIN post_search_index psi ON p.id = psi.post_id
    WHERE p.deleted_at IS NULL
      AND p.published = true
      AND psi.embedding IS NOT NULL
      AND 1 - (psi.embedding <=> ${JSON.stringify(embedding)}::vector) > ${threshold}
    ORDER BY similarity DESC
    LIMIT 10
  `)
  console.log('\n5. RAW SQL results:', rawRows.rows.length)
  if (rawRows.rows.length > 0) {
    console.log('   Top result:', rawRows.rows[0])
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
