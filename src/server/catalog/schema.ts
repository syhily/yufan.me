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
// and are edited through `/wp-admin/pages`.
export type Page = ClientPage & {
  /** PortableText body of the published revision (empty when the page has no published revision yet). */
  body: PortableTextBody
  /** S3 storage paths referenced by `image` blocks in the body. */
  imageSources: string[]
  /** `content.id` of the published revision, used as a cache key. */
  publishedRevisionId: bigint | null
}

// Posts live exclusively in the `post` + `content` Postgres tables
// and are edited through `/wp-admin/posts`.
export type Post = ClientPost & {
  body: PortableTextBody
  imageSources: string[]
}

export function toClientPost(post: Post): ClientPost {
  const { body: _body, imageSources: _imageSources, ...rest } = post
  return rest
}

export function toClientPage(page: Page): ClientPage {
  const { body: _body, imageSources: _imageSources, publishedRevisionId: _rev, ...rest } = page
  return rest
}
