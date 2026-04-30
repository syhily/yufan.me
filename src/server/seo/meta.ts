import type { MetaDescriptor } from 'react-router'

// IMPORTANT: this module is imported by every route's `meta()` export
// and `meta()` runs on the client too (after client-side navigation).
// That means anything imported here ends up in the client bundle, so
// we read settings through the **shared** snapshot reader — never
// through `@/server/*`, which would drag Drizzle/Postgres into the
// browser. On the server the snapshot is hydrated by the settings
// service; on the client the root loader pushes the same value into
// the shared `globalThis` slot on every render.
//
// `getBlogConfigSync()` returns `null` on a fresh, uninstalled
// deployment. The install gate catches every non-install request
// before any meta callback runs, but the install route itself still
// sits in front of the gate, so each helper handles a `null` config
// defensively.
import { getBlogConfigSync } from '@/shared/blog-config-snapshot'
import { joinUrl } from '@/shared/urls'

// Minimal sentinel rendered before the install flow has populated the
// settings row. The wp-admin SPA never reaches `routeMeta` (it owns its
// own meta), so the only consumer is the install split-screen — a few
// generic tags is plenty until the editor finishes installing.
const PRE_INSTALL_TITLE = '正在安装'

interface ArticleSeo {
  date: Date | string
  updated?: Date | string
  category?: string
  tags?: string[]
}

type SeoVariant = { kind: 'page'; article: ArticleSeo } | { kind: 'post'; article: ArticleSeo } | { kind: 'website' }

export interface FeedLinkOptions {
  /** RSS feed URL (absolute or root-relative). */
  rss?: string
  /** Atom feed URL (absolute or root-relative). */
  atom?: string
  /**
   * Optional `<link title>` shown by feed readers. When omitted, falls back
   * to the page title so readers can distinguish per-category/per-tag feeds
   * from the site-wide one.
   */
  title?: string
}

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
  /**
   * Additional `<link rel="alternate">` entries advertising scoped feeds
   * (per-category, per-tag, …). These append to — never replace — the
   * site-wide feeds emitted by `baseTags()`.
   */
  feedLinks?: FeedLinkOptions
}

function absoluteUrl(url: string | undefined, website: string): string | undefined {
  if (!url) return undefined
  return url.startsWith('http') ? url : website + url
}

function resolveOgImage(website: string, ogImageUrl?: string): string {
  if (ogImageUrl === undefined) return joinUrl(website, 'images/open-graph.png')
  return ogImageUrl.startsWith('http') ? ogImageUrl : joinUrl(website, ogImageUrl)
}

function ensureTwitterHandle(handle?: string): string | undefined {
  if (handle === undefined || handle === '') return undefined
  return handle.startsWith('@') ? handle : `@${handle}`
}

export function pageTitle(title?: string): string {
  const config = getBlogConfigSync()
  if (config === null) return title ?? PRE_INSTALL_TITLE
  return title === undefined ? `${config.title} - ${config.description}` : `${title} - ${config.title}`
}

function baseTags(
  title: string,
  description: string,
  config: { title: string; author: { name: string; url: string }; keywords: string[]; website: string },
): MetaDescriptor[] {
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

function ogTags(
  args: {
    variant: SeoVariant
    title: string
    description: string
    pageUrl: string
    imageUrl: string
    imageAlt: string
  },
  config: { settings: { locale: string; og: { width: number; height: number } } },
): MetaDescriptor[] {
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

function twitterTags(
  args: {
    title: string
    description: string
    imageUrl: string
    imageAlt: string
  },
  twitter: string,
): MetaDescriptor[] {
  const site = ensureTwitterHandle(twitter)
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

function articleTags(variant: SeoVariant, authorName: string): MetaDescriptor[] {
  if (variant.kind === 'website') return []

  const meta: MetaDescriptor[] = []
  if (variant.article.updated) {
    meta.push({ property: 'article:modified_time', content: toIsoString(variant.article.updated) })
  }
  meta.push(
    { property: 'article:published_time', content: toIsoString(variant.article.date) },
    { property: 'article:author', content: authorName },
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
  feedLinks,
}: RouteSeoOptions = {}): MetaDescriptor[] {
  const config = getBlogConfigSync()
  if (config === null) {
    // Pre-install fallback. The install split-screen renders before the
    // gate has any settings to hand out; emit a minimal `<title>` so
    // browsers don't show "untitled" and call it a day.
    return [{ title: title ?? PRE_INSTALL_TITLE }, ...robotsTags(true)]
  }

  const resolvedTitle = pageTitle(title)
  const resolvedDescription = description || config.description
  const resolvedPageUrl = absoluteUrl(pageUrl, config.website) || config.website
  const imageUrl = resolveOgImage(config.website, ogImageUrl)
  const imageAlt = ogImageAltText || resolvedTitle

  const meta: MetaDescriptor[] = [
    ...baseTags(resolvedTitle, resolvedDescription, config),
    ...robotsTags(noindex),
    ...ogTags(
      {
        variant,
        title: resolvedTitle,
        description: resolvedDescription,
        pageUrl: resolvedPageUrl,
        imageUrl,
        imageAlt,
      },
      config,
    ),
    ...articleTags(variant, config.author.name),
    ...twitterTags(
      { title: resolvedTitle, description: resolvedDescription, imageUrl, imageAlt },
      config.settings.twitter,
    ),
  ]

  if (canonical) {
    meta.push({ tagName: 'link', rel: 'canonical', href: resolvedPageUrl })
  }
  const prevHref = absoluteUrl(prevUrl, config.website)
  if (prevHref) {
    meta.push({ tagName: 'link', rel: 'prev', href: prevHref })
  }
  const nextHref = absoluteUrl(nextUrl, config.website)
  if (nextHref) {
    meta.push({ tagName: 'link', rel: 'next', href: nextHref })
  }

  if (feedLinks) {
    const feedTitle = feedLinks.title ?? resolvedTitle
    const rssHref = absoluteUrl(feedLinks.rss, config.website)
    if (rssHref) {
      meta.push({
        tagName: 'link',
        rel: 'alternate',
        type: 'application/rss+xml',
        title: feedTitle,
        href: rssHref,
      })
    }
    const atomHref = absoluteUrl(feedLinks.atom, config.website)
    if (atomHref) {
      meta.push({
        tagName: 'link',
        rel: 'alternate',
        type: 'application/atom+xml',
        title: feedTitle,
        href: atomHref,
      })
    }
  }

  return meta
}
