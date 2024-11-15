// This file is copied from https://github.com/flexdinesh/blogster/blob/main/packages/shared/src/seo.ts
// I just modified it for my personal needs.
import { urlJoin } from '@/helpers/tools';
import options from '@/options';

export interface PageMeta {
  title: string;
  description: string;
  baseUrl?: string;
  ogImageUrl?: string;
  ogImageAltText: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  siteOwnerTwitterHandle?: string;
  contentAuthorTwitterHandle?: string;
}

export interface PostMeta {
  title: string;
  description: string;
  pageUrl?: string;
  authorName?: string;
  publishDate: string;
  ogImageUrl?: string;
  ogImageAltText: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  siteOwnerTwitterHandle?: string;
  contentAuthorTwitterHandle?: string;
}

export interface TwitterOgMeta {
  title: string;
  description?: string;
  card: 'summary_large_image';
  site?: string;
  creator?: string;
  image?: string;
  imageAlt?: string;
}

export interface PageOgMeta {
  title: string;
  description?: string;
  type: 'website';
  url?: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: string;
  imageHeight?: string;
}

export interface PostOgMeta {
  title: string;
  description?: string;
  type: 'article';
  url?: string;
  author?: string;
  siteName?: string;
  publishDate: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: string;
  imageHeight?: string;
}

const parseOgImageUrl = (ogImageUrl?: string): string =>
  typeof ogImageUrl === 'undefined'
    ? options.defaultOpenGraph()
    : ogImageUrl.startsWith('/')
      ? urlJoin(options.assetsPrefix(), ogImageUrl)
      : ogImageUrl;

export const getPageMeta = ({
  title,
  description,
  baseUrl,
  ogImageUrl,
  ogImageAltText,
  ogImageWidth,
  ogImageHeight,
  siteOwnerTwitterHandle,
  contentAuthorTwitterHandle,
}: PageMeta): { og: PageOgMeta; twitter: TwitterOgMeta } => {
  if (!title) {
    throw Error('title is required for page SEO');
  }
  const ogImageAbsoluteUrl = parseOgImageUrl(ogImageUrl);

  return {
    og: {
      title: title,
      description: description,
      type: 'website',
      url: baseUrl,
      image: ogImageAbsoluteUrl,
      imageAlt: ogImageAltText,
      imageWidth: ogImageWidth ? String(ogImageWidth) : undefined,
      imageHeight: ogImageHeight ? String(ogImageHeight) : undefined,
    },
    twitter: {
      title: title,
      description: description,
      card: 'summary_large_image',
      site: siteOwnerTwitterHandle,
      creator: contentAuthorTwitterHandle || siteOwnerTwitterHandle,
      image: ogImageAbsoluteUrl,
      imageAlt: ogImageAltText,
    },
  };
};

export const getBlogPostMeta = ({
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
}: PostMeta): { og: PostOgMeta; twitter: TwitterOgMeta } => {
  if (!title) {
    throw Error('title is required for page SEO');
  }
  const ogImageAbsoluteUrl = parseOgImageUrl(ogImageUrl);

  return {
    og: {
      title: title,
      description: description,
      type: 'article',
      url: pageUrl,
      author: authorName,
      publishDate: publishDate,
      image: ogImageAbsoluteUrl,
      imageAlt: ogImageAltText,
      imageWidth: ogImageWidth ? String(ogImageWidth) : undefined,
      imageHeight: ogImageHeight ? String(ogImageHeight) : undefined,
    },
    twitter: {
      title: title,
      description: description,
      card: 'summary_large_image',
      site: siteOwnerTwitterHandle,
      creator: contentAuthorTwitterHandle || siteOwnerTwitterHandle,
      image: ogImageAbsoluteUrl,
      imageAlt: ogImageAltText,
    },
  };
};
