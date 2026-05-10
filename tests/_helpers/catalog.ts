import type { ClientCategory, ClientPage, ClientPost, ClientTag } from '@/shared/catalog'

let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

export function makeTag(overrides: Partial<ClientTag> = {}): ClientTag {
  const slug = overrides.slug ?? nextId('tag')
  return {
    name: overrides.name ?? slug,
    slug,
    counts: overrides.counts ?? 1,
    permalink: overrides.permalink ?? `/tags/${slug}`,
  }
}

export function makeCategory(overrides: Partial<ClientCategory> = {}): ClientCategory {
  const slug = overrides.slug ?? nextId('category')
  return {
    name: overrides.name ?? slug,
    slug,
    cover: overrides.cover ?? '/images/cover.png',
    description: overrides.description ?? '',
    counts: overrides.counts ?? 1,
    permalink: overrides.permalink ?? `/cats/${slug}`,
    ...overrides,
  }
}

export function makePost(overrides: Partial<ClientPost> = {}): ClientPost {
  const slug = overrides.slug ?? nextId('post')
  return {
    id: overrides.id ?? nextId('post-id'),
    title: overrides.title ?? `Post ${slug}`,
    date: overrides.date ?? new Date('2024-01-01T00:00:00.000Z'),
    comments: overrides.comments ?? true,
    alias: overrides.alias ?? [],
    tags: overrides.tags ?? [],
    category: overrides.category ?? 'general',
    summary: overrides.summary ?? 'summary',
    cover: overrides.cover ?? '/images/cover.png',
    published: overrides.published ?? true,
    visible: overrides.visible ?? true,
    toc: overrides.toc ?? true,
    slug,
    permalink: overrides.permalink ?? `/posts/${slug}`,
    headings: overrides.headings ?? [],
    ...overrides,
  }
}

export function makePage(overrides: Partial<ClientPage> = {}): ClientPage {
  const slug = overrides.slug ?? nextId('page')
  return {
    id: overrides.id ?? nextId('page-id'),
    title: overrides.title ?? `Page ${slug}`,
    date: overrides.date ?? new Date('2024-01-01T00:00:00.000Z'),
    comments: overrides.comments ?? false,
    cover: overrides.cover ?? '/images/cover.png',
    published: overrides.published ?? true,
    summary: overrides.summary ?? '',
    toc: overrides.toc ?? false,
    showFriends: overrides.showFriends ?? false,
    slug,
    permalink: overrides.permalink ?? `/${slug}`,
    headings: overrides.headings ?? [],
    ...overrides,
  }
}

export function makePostList(count: number, overrides: Partial<ClientPost> = {}): ClientPost[] {
  return Array.from({ length: count }, (_, i) => {
    const itemOverrides: Partial<ClientPost> = { ...overrides }
    if (overrides.slug) {
      itemOverrides.slug = `${overrides.slug}-${i}`
    }
    if (overrides.title) {
      itemOverrides.title = `${overrides.title} ${i}`
    }
    return makePost(itemOverrides)
  })
}
