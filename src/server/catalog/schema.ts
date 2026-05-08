import type { StructuredData } from 'fumadocs-core/mdx-plugins'
import type { MDXContent } from 'mdx/types'

import type { ClientPage, ClientPost } from '@/shared/catalog'

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

export type Page = ClientPage & {
  body: MDXContent
  /** Path into the Fumadocs MDX browser collection (e.g. "about.mdx"). */
  mdxPath: string
  /** Image URLs discovered at build time from the MDX AST. */
  imageSources: string[]
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
  const { body: _body, mdxPath: _mdxPath, ...rest } = page
  return rest
}
