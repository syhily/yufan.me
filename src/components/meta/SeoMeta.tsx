import type { Page, Post } from '@/services/catalog/schema'

import config from '@/blog.config'
import { getPageMeta } from '@/services/seo'

// Unified Open Graph + Twitter card meta tag emitter. The `variant` prop
// controls whether `og:type` is "website" or "article" and adds the
// `article:*` tags (modified_time, tags, author, ...).
export type SeoArticle = { kind: 'page'; article: Page } | { kind: 'post'; article: Post } | { kind: 'website' }

export interface SeoMetaProps {
  title?: string
  description?: string
  /** Absolute or site-relative URL of the current page. */
  pageUrl?: string
  ogImageUrl?: string
  ogImageAltText?: string
  /** Choose between website / page / post variants. Defaults to website. */
  variant?: SeoArticle
  /** Emit a <link rel="canonical"> tag pointing at pageUrl. */
  canonical?: boolean
  /** rel="prev" target. Useful on paginated listings for SEO. */
  prevUrl?: string
  /** rel="next" target. Useful on paginated listings for SEO. */
  nextUrl?: string
  /** Emit <meta name="robots" content="noindex,follow"> (e.g. paginated listings). */
  noindex?: boolean
}

function absoluteUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('http') ? url : import.meta.env.SITE + url
}

export function SeoMeta({
  title,
  description,
  pageUrl,
  ogImageUrl,
  ogImageAltText,
  variant = { kind: 'website' },
  canonical = false,
  prevUrl,
  nextUrl,
  noindex = false,
}: SeoMetaProps) {
  const resolvedTitle = title || config.title
  const resolvedDescription = description || config.description
  const resolvedPageUrl = pageUrl
    ? pageUrl.startsWith('http')
      ? pageUrl
      : import.meta.env.SITE + pageUrl
    : import.meta.env.SITE

  const { og, twitter } = getPageMeta({
    title: resolvedTitle,
    description: resolvedDescription,
    pageUrl: resolvedPageUrl,
    ogImageUrl,
    ogImageAltText: ogImageAltText || resolvedTitle,
    ogImageWidth: config.settings.og.width,
    ogImageHeight: config.settings.og.height,
    siteOwnerTwitterHandle: config.settings.twitter,
    contentAuthorTwitterHandle: config.settings.twitter,
  })

  const ogType = variant.kind === 'website' ? 'website' : 'article'

  return (
    <>
      {canonical && og.url && <link rel="canonical" href={og.url} />}
      {prevUrl && <link rel="prev" href={absoluteUrl(prevUrl)} />}
      {nextUrl && <link rel="next" href={absoluteUrl(nextUrl)} />}
      {noindex && <meta name="robots" content="noindex,follow" />}
      {og.title && <meta property="og:title" content={og.title} />}
      {og.description && <meta property="og:description" content={og.description} />}
      <meta property="og:type" content={ogType} />
      {og.url && <meta property="og:url" content={og.url} />}
      {og.image && <meta property="og:image" content={og.image} />}
      {og.imageAlt && <meta property="og:image:alt" content={og.imageAlt} />}
      {og.imageWidth && <meta property="og:image:width" content={og.imageWidth} />}
      {og.imageHeight && <meta property="og:image:height" content={og.imageHeight} />}
      <meta property="og:locale" content={config.settings.locale} />
      {variant.kind === 'page' && (
        <>
          {variant.article.updated && (
            <meta property="article:modified_time" content={variant.article.updated.toISOString()} />
          )}
          {variant.article.date && (
            <meta property="article:published_time" content={variant.article.date.toISOString()} />
          )}
          <meta property="article:author" content={config.author.name} />
          <meta property="article:section" content="页面" />
        </>
      )}
      {variant.kind === 'post' && (
        <>
          {variant.article.updated && (
            <meta property="article:modified_time" content={variant.article.updated.toISOString()} />
          )}
          {variant.article.date && (
            <meta property="article:published_time" content={variant.article.date.toISOString()} />
          )}
          {variant.article.tags.map((tag) => (
            <meta key={tag} property="article:tag" content={tag} />
          ))}
          <meta property="article:author" content={config.author.name} />
          <meta property="article:section" content={variant.article.category} />
        </>
      )}
      {twitter.title && <meta property="twitter:title" content={twitter.title} />}
      {twitter.description && <meta property="twitter:description" content={twitter.description} />}
      {twitter.site && <meta property="twitter:site" content={twitter.site} />}
      {twitter.creator && <meta property="twitter:creator" content={twitter.creator} />}
      <meta property="twitter:card" content="summary_large_image" />
      {twitter.image && <meta property="twitter:image" content={twitter.image} />}
      {twitter.imageAlt && <meta property="twitter:image:alt" content={twitter.imageAlt} />}
    </>
  )
}
