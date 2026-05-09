import type { StructuredData } from 'fumadocs-core/mdx-plugins'
import type { MDXContent } from 'mdx/types'

import type { ClientPage, ClientPost } from '@/shared/catalog'
import type { PortableTextBody } from '@/shared/portable-text'

export type {
  Category,
  ClientCategory,
  ClientPage,
  ClientPost,
  ClientPostWithMetadata,
  ClientTag,
  Friend,
  LoadPostsWithMetadataOptions,
  MarkdownHeading,
  PostMetadata,
  PostVisibilityOptions,
  Tag,
} from '@/shared/catalog'

// Page entries can come from two sources during the MDX → PortableText
// migration: the historical Fumadocs MDX collection and the new
// `page` + `content` Postgres tables. The `source` discriminator
// lets the detail route pick the right renderer; everything else
// (URLs, SEO, comment threading) is identical because both sources
// project into the same `ClientPage` shape.
export type MdxPage = ClientPage & {
  source: 'mdx'
  body: MDXContent
  /** Path into the Fumadocs MDX browser collection (e.g. "about.mdx"). */
  mdxPath: string
  /** Image URLs discovered at build time from the MDX AST. */
  imageSources: string[]
}

export type DbPage = ClientPage & {
  source: 'db'
  /** PortableText body of the published revision (empty when the page has no published revision yet). */
  body: PortableTextBody
  /** S3 storage paths referenced by `image` blocks in the body. */
  imageSources: string[]
  /** `content.id` of the published revision, used as a cache key. */
  publishedRevisionId: bigint | null
}

export type Page = MdxPage | DbPage

export type Post = ClientPost & {
  body: MDXContent
  structuredData: StructuredData
  /** Path into the Fumadocs MDX browser collection (e.g. "2025/2025-01-04-foo.mdx"). */
  mdxPath: string
  /** Image URLs discovered at build time from the MDX AST. */
  imageSources: string[]
}

export function toClientPost(post: Post): ClientPost {
  const { body: _body, structuredData: _structuredData, mdxPath: _mdxPath, ...rest } = post
  return rest
}

export function toClientPage(page: Page): ClientPage {
  if (page.source === 'mdx') {
    const { source: _source, body: _body, mdxPath: _mdxPath, imageSources: _imageSources, ...rest } = page
    return rest
  }
  const { source: _source, body: _body, imageSources: _imageSources, publishedRevisionId: _rev, ...rest } = page
  return rest
}
