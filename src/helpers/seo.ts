// This file is copied from https://github.com/flexdinesh/blogster/blob/main/packages/shared/src/seo.ts
// I just modified it for my personal needs.
import { joinPaths } from '@astrojs/internal-helpers/path'

export interface PageMeta {
  title: string
  description: string
  baseUrl?: string
  ogImageUrl?: string
  ogImageAltText: string
  ogImageWidth?: number
  ogImageHeight?: number
  siteOwnerTwitterHandle?: string
  contentAuthorTwitterHandle?: string
}

export interface PostMeta {
  title: string
  description: string
  pageUrl?: string
  authorName?: string
  publishDate: string
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
  type: 'website'
  url?: string
  image?: string
  imageAlt?: string
  imageWidth?: string
  imageHeight?: string
}

export interface PostOgMeta {
  title: string
  description?: string
  type: 'article'
  url?: string
  author?: string
  siteName?: string
  publishDate: string
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

export function getPageMeta({
  title,
  description,
  baseUrl,
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
      type: 'website',
      url: baseUrl,
      image: ogImageAbsoluteUrl,
      imageAlt: ogImageAltText,
      imageWidth: ogImageWidth ? String(ogImageWidth) : undefined,
      imageHeight: ogImageHeight ? String(ogImageHeight) : undefined,
    },
    twitter: {
      title,
      description,
      card: 'summary_large_image',
      site: siteOwnerTwitterHandle,
      creator: contentAuthorTwitterHandle || siteOwnerTwitterHandle,
      image: ogImageAbsoluteUrl,
      imageAlt: ogImageAltText,
    },
  }
}

export function getBlogPostMeta({
  title,
  description,
  pageUrl,
  authorName,
  publishDate,
  ogImageUrl,
  ogImageAltText,
  ogImageWidth,
  ogImageHeight,
  siteOwnerTwitterHandle,
  contentAuthorTwitterHandle,
}: PostMeta): { og: PostOgMeta, twitter: TwitterOgMeta } {
  if (!title) {
    throw new Error('title is required for page SEO')
  }
  const ogImageAbsoluteUrl = parseOgImageUrl(ogImageUrl)

  return {
    og: {
      title,
      description,
      type: 'article',
      url: pageUrl,
      author: authorName,
      publishDate,
      image: ogImageAbsoluteUrl,
      imageAlt: ogImageAltText,
      imageWidth: ogImageWidth ? String(ogImageWidth) : undefined,
      imageHeight: ogImageHeight ? String(ogImageHeight) : undefined,
    },
    twitter: {
      title,
      description,
      card: 'summary_large_image',
      site: siteOwnerTwitterHandle,
      creator: contentAuthorTwitterHandle || siteOwnerTwitterHandle,
      image: ogImageAbsoluteUrl,
      imageAlt: ogImageAltText,
    },
  }
}
