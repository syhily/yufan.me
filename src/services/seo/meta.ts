import type { MetaDescriptor } from 'react-router'

import type { Page, Post } from '@/services/catalog/schema'

import config from '@/blog.config'
import { getPageMeta } from '@/services/seo'

type SeoVariant = { kind: 'page'; article: Page } | { kind: 'post'; article: Post } | { kind: 'website' }

export interface RouteSeoOptions {
  title?: string
  description?: string
  pageUrl?: string
  ogImageUrl?: string
  ogImageAltText?: string
  variant?: SeoVariant
  canonical?: boolean
  prevUrl?: string
  nextUrl?: string
  noindex?: boolean
}

function absoluteUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('http') ? url : import.meta.env.SITE + url
}

export function pageTitle(title?: string): string {
  return title === undefined ? `${config.title} - ${config.description}` : `${title} - ${config.title}`
}

export function routeMeta({
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
}: RouteSeoOptions = {}): MetaDescriptor[] {
  const resolvedTitle = pageTitle(title)
  const resolvedDescription = description || config.description
  const resolvedPageUrl = absoluteUrl(pageUrl) || import.meta.env.SITE
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

  const meta: MetaDescriptor[] = [
    { title: resolvedTitle },
    { name: 'title', content: resolvedTitle },
    { name: 'description', content: resolvedDescription },
    { name: 'generator', content: 'WordPress 3.2.1' },
    { name: 'author', content: config.author.name },
    { tagName: 'link', rel: 'author', href: config.author.url },
    { name: 'keywords', content: config.keywords.join(',') },
    { name: 'robots', content: noindex ? 'noindex,follow' : 'index, follow' },
    {
      name: 'googlebot',
      content: noindex
        ? 'noindex,follow'
        : 'index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1',
    },
    {
      tagName: 'link',
      rel: 'alternate',
      type: 'application/rss+xml',
      title: config.title,
      href: `${config.website}/feed/`,
    },
    {
      tagName: 'link',
      rel: 'alternate',
      type: 'application/atom+xml',
      title: config.title,
      href: `${config.website}/feed/atom/`,
    },
    { tagName: 'link', rel: 'sitemap', href: `${config.website}/sitemap.xml` },
    { tagName: 'link', rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
    { tagName: 'link', rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    { tagName: 'link', rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    { tagName: 'link', rel: 'manifest', href: '/manifest.webmanifest' },
  ]

  if (canonical && og.url) {
    meta.push({ tagName: 'link', rel: 'canonical', href: og.url })
  }
  const prevHref = absoluteUrl(prevUrl)
  if (prevHref) {
    meta.push({ tagName: 'link', rel: 'prev', href: prevHref })
  }
  const nextHref = absoluteUrl(nextUrl)
  if (nextHref) {
    meta.push({ tagName: 'link', rel: 'next', href: nextHref })
  }

  const ogType = variant.kind === 'website' ? 'website' : 'article'
  meta.push({ property: 'og:type', content: ogType }, { property: 'og:locale', content: config.settings.locale })
  if (og.title) meta.push({ property: 'og:title', content: og.title })
  if (og.description) meta.push({ property: 'og:description', content: og.description })
  if (og.url) meta.push({ property: 'og:url', content: og.url })
  if (og.image) meta.push({ property: 'og:image', content: og.image })
  if (og.imageAlt) meta.push({ property: 'og:image:alt', content: og.imageAlt })
  if (og.imageWidth) meta.push({ property: 'og:image:width', content: og.imageWidth })
  if (og.imageHeight) meta.push({ property: 'og:image:height', content: og.imageHeight })

  if (variant.kind === 'page') {
    if (variant.article.updated) {
      meta.push({ property: 'article:modified_time', content: variant.article.updated.toISOString() })
    }
    meta.push(
      { property: 'article:published_time', content: variant.article.date.toISOString() },
      { property: 'article:author', content: config.author.name },
      { property: 'article:section', content: '页面' },
    )
  }

  if (variant.kind === 'post') {
    if (variant.article.updated) {
      meta.push({ property: 'article:modified_time', content: variant.article.updated.toISOString() })
    }
    meta.push(
      { property: 'article:published_time', content: variant.article.date.toISOString() },
      { property: 'article:author', content: config.author.name },
      { property: 'article:section', content: variant.article.category },
    )
    for (const tag of variant.article.tags) {
      meta.push({ property: 'article:tag', content: tag })
    }
  }

  if (twitter.title) meta.push({ property: 'twitter:title', content: twitter.title })
  if (twitter.description) meta.push({ property: 'twitter:description', content: twitter.description })
  if (twitter.site) meta.push({ property: 'twitter:site', content: twitter.site })
  if (twitter.creator) meta.push({ property: 'twitter:creator', content: twitter.creator })
  meta.push({ property: 'twitter:card', content: twitter.card })
  if (twitter.image) meta.push({ property: 'twitter:image', content: twitter.image })
  if (twitter.imageAlt) meta.push({ property: 'twitter:image:alt', content: twitter.imageAlt })

  return meta
}
