import type { MetaDescriptor } from 'react-router'

import config from '@/blog.config'
import { joinUrl } from '@/shared/urls'

interface ArticleSeo {
  date: Date | string
  updated?: Date | string
  category?: string
  tags?: string[]
}

type SeoVariant = { kind: 'page'; article: ArticleSeo } | { kind: 'post'; article: ArticleSeo } | { kind: 'website' }

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
  return url.startsWith('http') ? url : config.website + url
}

function resolveOgImage(ogImageUrl?: string): string {
  if (ogImageUrl === undefined) return joinUrl(config.website, 'images/open-graph.png')
  return ogImageUrl.startsWith('http') ? ogImageUrl : joinUrl(config.website, ogImageUrl)
}

function ensureTwitterHandle(handle?: string): string | undefined {
  if (handle === undefined || handle === '') return undefined
  return handle.startsWith('@') ? handle : `@${handle}`
}

export function pageTitle(title?: string): string {
  return title === undefined ? `${config.title} - ${config.description}` : `${title} - ${config.title}`
}

function baseTags(title: string, description: string): MetaDescriptor[] {
  return [
    { title },
    { name: 'title', content: title },
    { name: 'description', content: description },
    { name: 'generator', content: 'WordPress 3.2.1' },
    { name: 'author', content: config.author.name },
    { tagName: 'link', rel: 'author', href: config.author.url },
    { name: 'keywords', content: config.keywords.join(',') },
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
}

function robotsTags(noindex: boolean): MetaDescriptor[] {
  return [
    { name: 'robots', content: noindex ? 'noindex,follow' : 'index, follow' },
    {
      name: 'googlebot',
      content: noindex
        ? 'noindex,follow'
        : 'index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1',
    },
  ]
}

function ogTags(args: {
  variant: SeoVariant
  title: string
  description: string
  pageUrl: string
  imageUrl: string
  imageAlt: string
}): MetaDescriptor[] {
  const type = args.variant.kind === 'website' ? 'website' : 'article'
  const meta: MetaDescriptor[] = [
    { property: 'og:type', content: type },
    { property: 'og:locale', content: config.settings.locale },
    { property: 'og:title', content: args.title },
    { property: 'og:description', content: args.description },
    { property: 'og:url', content: args.pageUrl },
    { property: 'og:image', content: args.imageUrl },
    { property: 'og:image:alt', content: args.imageAlt },
  ]
  if (config.settings.og.width) {
    meta.push({ property: 'og:image:width', content: String(config.settings.og.width) })
  }
  if (config.settings.og.height) {
    meta.push({ property: 'og:image:height', content: String(config.settings.og.height) })
  }
  return meta
}

function twitterTags(args: {
  title: string
  description: string
  imageUrl: string
  imageAlt: string
}): MetaDescriptor[] {
  const site = ensureTwitterHandle(config.settings.twitter)
  const meta: MetaDescriptor[] = [
    { property: 'twitter:title', content: args.title },
    { property: 'twitter:description', content: args.description },
  ]
  if (site) {
    meta.push({ property: 'twitter:site', content: site }, { property: 'twitter:creator', content: site })
  }
  meta.push(
    { property: 'twitter:card', content: 'summary_large_image' },
    { property: 'twitter:image', content: args.imageUrl },
    { property: 'twitter:image:alt', content: args.imageAlt },
  )
  return meta
}

function articleTags(variant: SeoVariant): MetaDescriptor[] {
  if (variant.kind === 'website') return []

  const meta: MetaDescriptor[] = []
  if (variant.article.updated) {
    meta.push({ property: 'article:modified_time', content: toIsoString(variant.article.updated) })
  }
  meta.push(
    { property: 'article:published_time', content: toIsoString(variant.article.date) },
    { property: 'article:author', content: config.author.name },
    {
      property: 'article:section',
      content: variant.kind === 'page' ? '页面' : (variant.article.category ?? ''),
    },
  )
  if (variant.kind === 'post') {
    for (const tag of variant.article.tags ?? []) {
      meta.push({ property: 'article:tag', content: tag })
    }
  }
  return meta
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

// Pure helpers consumed by detail-page `meta()` callbacks. Shaping the SEO
// payload here means detail loaders no longer need to ship a denormalised
// `seo: {...}` field over the wire on every client navigation — `meta()`
// reads the post/page directly and projects it into `RouteSeoOptions`.
export interface PostMetaShape {
  title: string
  slug: string
  summary: string
  permalink: string
  og?: string
  date: Date | string
  updated?: Date | string
  category: string
  tags: string[]
}

export function seoForPost(post: PostMetaShape): RouteSeoOptions {
  return {
    title: post.title,
    description: post.summary,
    pageUrl: post.permalink,
    ogImageUrl: post.og ? post.og : `/images/og/${post.slug}.png`,
    ogImageAltText: post.title,
    variant: {
      kind: 'post',
      article: {
        date: post.date,
        updated: post.updated,
        category: post.category,
        tags: post.tags,
      },
    },
    canonical: true,
  }
}

export interface PageMetaShape {
  title: string
  slug: string
  summary: string
  permalink: string
  og?: string
  date: Date | string
  updated?: Date | string
}

export function seoForPage(page: PageMetaShape): RouteSeoOptions {
  return {
    title: page.title,
    description: page.summary,
    pageUrl: page.permalink,
    ogImageUrl: page.og ? page.og : `/images/og/${page.slug}.png`,
    ogImageAltText: page.title,
    variant: {
      kind: 'page',
      article: { date: page.date, updated: page.updated },
    },
    canonical: true,
  }
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
  const resolvedPageUrl = absoluteUrl(pageUrl) || config.website
  const imageUrl = resolveOgImage(ogImageUrl)
  const imageAlt = ogImageAltText || resolvedTitle

  const meta: MetaDescriptor[] = [
    ...baseTags(resolvedTitle, resolvedDescription),
    ...robotsTags(noindex),
    ...ogTags({
      variant,
      title: resolvedTitle,
      description: resolvedDescription,
      pageUrl: resolvedPageUrl,
      imageUrl,
      imageAlt,
    }),
    ...articleTags(variant),
    ...twitterTags({ title: resolvedTitle, description: resolvedDescription, imageUrl, imageAlt }),
  ]

  if (canonical) {
    meta.push({ tagName: 'link', rel: 'canonical', href: resolvedPageUrl })
  }
  const prevHref = absoluteUrl(prevUrl)
  if (prevHref) {
    meta.push({ tagName: 'link', rel: 'prev', href: prevHref })
  }
  const nextHref = absoluteUrl(nextUrl)
  if (nextHref) {
    meta.push({ tagName: 'link', rel: 'next', href: nextHref })
  }

  return meta
}
