import type {
  ClientPage,
  ClientPost,
  DetailPageShell,
  DetailPostShell,
  ListingPostCard,
  SidebarPostLink,
} from '@/shared/catalog'

export type {
  CommentFormUser,
  DetailPageShell,
  DetailPostShell,
  ListingPostCard,
  ListingPostCardWithMetadata,
  SidebarPostLink,
  SidebarTagLink,
} from '@/shared/catalog'

export function toListingPostCard(post: ClientPost): ListingPostCard {
  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    cover: post.cover,
    coverThumbhash: post.coverThumbhash,
    permalink: post.permalink,
    category: post.category,
    date: post.date,
    published: post.published,
  }
}

export function toDetailPostShell(post: ClientPost): DetailPostShell {
  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    cover: post.cover,
    coverThumbhash: post.coverThumbhash,
    permalink: post.permalink,
    category: post.category,
    tags: post.tags,
    date: post.date,
    updated: post.updated,
    og: post.og,
    comments: post.comments,
    toc: post.toc,
    headings: post.headings,
  }
}

export function toDetailPageShell(page: ClientPage): DetailPageShell {
  return {
    slug: page.slug,
    title: page.title,
    summary: page.summary,
    cover: page.cover,
    coverThumbhash: page.coverThumbhash,
    coverWidth: page.coverWidth,
    coverHeight: page.coverHeight,
    permalink: page.permalink,
    date: page.date,
    updated: page.updated,
    og: page.og,
    comments: page.comments,
    toc: page.toc,
    headings: page.headings,
  }
}

export function toSidebarPostLink(post: ClientPost): SidebarPostLink {
  return { slug: post.slug, title: post.title, permalink: post.permalink }
}
