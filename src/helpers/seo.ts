import { joinPaths } from '@astrojs/internal-helpers/path'

export interface PageMeta {
  title: string
  description: string
  pageUrl?: string
  ogImageUrl?: string
  ogImageAltText: string
  ogImageWidth?: number
  ogImageHeight?: number
  siteOwnerTwitterHandle?: string
  contentAuthorTwitterHandle?: string
}

export interface TwitterOgMeta {
  title: string
  description?: string
  card: 'summary_large_image'
  site?: string
  creator?: string
  image?: string
  imageAlt?: string
}

export interface PageOgMeta {
  title: string
  description?: string
  url?: string
  image?: string
  imageAlt?: string
  imageWidth?: string
  imageHeight?: string
}

function parseOgImageUrl(ogImageUrl?: string): string {
  return ogImageUrl === undefined
    ? `${import.meta.env.SITE}/images/open-graph.png`
    : !ogImageUrl.startsWith('http')
        ? joinPaths(import.meta.env.SITE, ogImageUrl)
        : ogImageUrl
}

function ensureTwitterHandle(handle?: string): string | undefined {
  if (handle !== undefined && !handle.startsWith('@')) {
    return `@${handle}`
  }
  return handle
}

export function getPageMeta({
  title,
  description,
  pageUrl,
  ogImageUrl,
  ogImageAltText,
  ogImageWidth,
  ogImageHeight,
  siteOwnerTwitterHandle,
  contentAuthorTwitterHandle,
}: PageMeta): { og: PageOgMeta, twitter: TwitterOgMeta } {
  if (!title) {
    throw new Error('title is required for page SEO')
  }
  const ogImageAbsoluteUrl = parseOgImageUrl(ogImageUrl)

  return {
    og: {
      title,
      description,
      url: pageUrl,
      image: ogImageAbsoluteUrl,
      imageAlt: ogImageAltText,
      imageWidth: ogImageWidth ? String(ogImageWidth) : undefined,
      imageHeight: ogImageHeight ? String(ogImageHeight) : undefined,
    },
    twitter: {
      title,
      description,
      card: 'summary_large_image',
      site: ensureTwitterHandle(siteOwnerTwitterHandle),
      creator: ensureTwitterHandle(contentAuthorTwitterHandle || siteOwnerTwitterHandle),
      image: ogImageAbsoluteUrl,
      imageAlt: ogImageAltText,
    },
  }
}
