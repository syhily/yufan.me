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

// Pages live exclusively in the `page` + `content` Postgres tables
// and are edited through `/wp-admin/pages`. The historical Fumadocs
// MDX collection (`src/content/pages/*.mdx`) and its discriminated
// `MdxPage | DbPage` union were retired together with the one-shot
// migration script; the catalog projects each `page` row directly
// into this single shape.
export type Page = ClientPage & {
  /** PortableText body of the published revision (empty when the page has no published revision yet). */
  body: PortableTextBody
  /** S3 storage paths referenced by `image` blocks in the body. */
  imageSources: string[]
  /** `content.id` of the published revision, used as a cache key. */
  publishedRevisionId: bigint | null
}

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
  const { body: _body, imageSources: _imageSources, publishedRevisionId: _rev, ...rest } = page
  return rest
}
