// This file is copied from https://github.com/flexdinesh/blogster/blob/main/packages/shared/src/seo.ts
// I just modified it for my personal needs.

type BaseMeta = {
  title: string;
  description?: string;
  canonicalUrl?: string;
};

type PageOgMeta = {
  title: string;
  description?: string;
  type: 'website';
  url?: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: string;
  imageHeight?: string;
};

type PageTwitterMeta = {
  title: string;
  description?: string;
  card: 'summary_large_image';
  site?: string;
  creator?: string;
  image?: string;
  imageAlt?: string;
};

type PostOgMeta = {
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
};

type PostTwitterMeta = {
  title: string;
  description?: string;
  card: 'summary_large_image';
  site?: string;
  creator?: string;
  image?: string;
  imageAlt?: string;
};

export function getPageMeta({
  title: pageTitle,
  description,
  baseUrl,
  ogImageAbsoluteUrl,
  ogImageAltText,
  ogImageWidth,
  ogImageHeight,
  siteOwnerTwitterHandle,
  contentAuthorTwitterHandle,
}: {
  title: string;
  description: string;
  baseUrl?: string;
  ogImageAbsoluteUrl?: string; // should always be absolute
  ogImageAltText?: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  siteOwnerTwitterHandle?: string;
  contentAuthorTwitterHandle?: string;
}): { meta: BaseMeta; og: PageOgMeta; twitter: PageTwitterMeta } {
  if (!pageTitle) {
    throw Error('title is required for page SEO');
  }
  if (ogImageAbsoluteUrl) {
    ogImageAltText = !ogImageAltText ? `Preview image for ${pageTitle}` : ogImageAltText;
  }

  const meta: BaseMeta = { title: pageTitle, description: description };

  const og: PageOgMeta = {
    title: pageTitle,
    description: description,
    type: 'website',
    url: baseUrl,
    image: ogImageAbsoluteUrl,
    imageAlt: ogImageAltText,
    imageWidth: ogImageWidth ? String(ogImageWidth) : undefined,
    imageHeight: ogImageHeight ? String(ogImageHeight) : undefined,
  };

  const twitter: PageTwitterMeta = {
    title: pageTitle,
    description: description,
    card: 'summary_large_image',
    site: siteOwnerTwitterHandle,
    creator: contentAuthorTwitterHandle || siteOwnerTwitterHandle,
    image: ogImageAbsoluteUrl,
    imageAlt: ogImageAltText,
  };

  return {
    meta,
    og,
    twitter,
  };
}

export function getBlogPostMeta({
  title: pageTitle,
  description,
  canonicalUrl,
  pageUrl,
  authorName,
  publishDate,
  ogImageAbsoluteUrl,
  ogImageAltText,
  ogImageWidth,
  ogImageHeight,
  siteOwnerTwitterHandle,
  contentAuthorTwitterHandle,
}: {
  title: string;
  description: string;
  canonicalUrl?: string;
  pageUrl?: string;
  authorName?: string;
  publishDate: string;
  ogImageAbsoluteUrl?: string; // should always be absolute
  ogImageAltText?: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  siteOwnerTwitterHandle?: string;
  contentAuthorTwitterHandle?: string;
}): { meta: BaseMeta; og: PostOgMeta; twitter: PostTwitterMeta } {
  if (!pageTitle) {
    throw Error('title is required for page SEO');
  }
  if (ogImageAbsoluteUrl && !ogImageAltText) {
    ogImageAltText = `Preview image for ${pageTitle}`;
  }

  const meta: BaseMeta = {
    title: pageTitle,
    description: description,
    canonicalUrl,
  };

  const og: PostOgMeta = {
    title: pageTitle,
    description: description,
    type: 'article',
    url: pageUrl,
    author: authorName,
    publishDate: publishDate,
    image: ogImageAbsoluteUrl,
    imageAlt: ogImageAltText,
    imageWidth: ogImageWidth ? String(ogImageWidth) : undefined,
    imageHeight: ogImageHeight ? String(ogImageHeight) : undefined,
  };

  const twitter: PostTwitterMeta = {
    title: pageTitle,
    description: description,
    card: 'summary_large_image',
    site: siteOwnerTwitterHandle,
    creator: contentAuthorTwitterHandle || siteOwnerTwitterHandle,
    image: ogImageAbsoluteUrl,
    imageAlt: ogImageAltText,
  };

  return {
    meta,
    og,
    twitter,
  };
}
