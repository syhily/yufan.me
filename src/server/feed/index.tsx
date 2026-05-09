import { Feed } from 'feed'

import { ContentCatalog, type Page, type Post } from '@/server/catalog'
import { prerenderToHtml } from '@/server/catalog/render'
import { requireBlogSettingsBundle, requireBlogSettingsSection } from '@/shared/blog-config'
import { joinUrl } from '@/shared/urls'
import { BlogSettingsProvider } from '@/ui/lib/blog-config-context'
import { MusicPlayer } from '@/ui/mdx/music/MusicPlayer'
import { Friends } from '@/ui/mdx/page/Friends'
import { Solution } from '@/ui/mdx/solutions/Solution'
import { PortableTextBody } from '@/ui/portable-text/PortableTextBody'

export interface FeedOptions {
  includeHidden?: boolean
  includeScheduled?: boolean
  size?: number
  category?: string
  tag?: string
}

const CONTENT_TYPES = {
  rss: 'application/xml; charset=utf-8',
  atom: 'application/atom+xml; charset=utf-8',
} as const

// Centralised cache headers for syndication feeds. Routes that re-export this
// from a `headers()` route module function will get cache-friendly behaviour
// without re-stating the policy.
export function feedHeaders(kind: 'rss' | 'atom'): HeadersInit {
  return {
    'Content-Type': CONTENT_TYPES[kind],
    'Cache-Control': 'public, max-age=1800',
  }
}

export async function feedResponse(
  kind: 'rss' | 'atom',
  filter?: Pick<FeedOptions, 'category' | 'tag'>,
): Promise<Response> {
  const feed = await generateFeeds(filter ?? {})
  const body = kind === 'rss' ? feed.rss : feed.atom
  return new Response(body, { headers: feedHeaders(kind) })
}

async function renderEntryContent(entry: Post | Page): Promise<string> {
  // Feed items ship as HTML (RSS/Atom can't carry a React tree). We prerender
  // the body but skip the image-enhancement pipeline: feed readers don't
  // need thumbhash placeholders or DB-resolved dimensions.
  const bundle = requireBlogSettingsBundle()
  // Pages can be sourced from MDX or from the DB during the migration.
  // The Post type stays MDX-only for now.
  if ('source' in entry && entry.source === 'db') {
    return prerenderToHtml(
      <BlogSettingsProvider value={bundle}>
        <PortableTextBody body={entry.body} headingSlugs={entry.headings.map((h) => h.slug)} />
      </BlogSettingsProvider>,
    )
  }
  const Body = entry.body
  return prerenderToHtml(
    <BlogSettingsProvider value={bundle}>
      <Body components={{ Friends, MusicPlayer, Solution }} />
    </BlogSettingsProvider>,
  )
}

export async function generateFeeds(options: FeedOptions = {}) {
  const siteIdentity = requireBlogSettingsSection('siteIdentity')
  const content = requireBlogSettingsSection('content')
  const footer = requireBlogSettingsSection('footer')
  const { includeHidden = true, includeScheduled = false, size = content.feed.size, category, tag } = options
  if (category !== undefined && tag !== undefined) {
    throw new Error('Category and tag cannot be specified at the same time')
  }
  const catalog = await ContentCatalog.get()
  const filtered = selectFeedPosts(catalog, { includeHidden, includeScheduled, category, tag })
  const feedPosts = filtered.slice(0, size)

  // Start to build the feed.
  const feed = new Feed({
    title: siteIdentity.title,
    description: siteIdentity.description,
    id: siteIdentity.website,
    link: siteIdentity.website,
    language: 'zh-CN',
    image: joinUrl(siteIdentity.website, '/logo.svg'),
    favicon: joinUrl(siteIdentity.website, '/favicon.svg'),
    copyright: `All rights reserved ${footer.footer.initialYear}, ${siteIdentity.author.name}`,
    updated: new Date(),
    generator: 'WordPress 3.2.1',
    feedLinks: {
      rss: `${siteIdentity.website}${category ? `/cats/${category}` : ''}${tag ? `/tags/${tag}` : ''}/feed`,
      atom: `${siteIdentity.website}${category ? `/cats/${category}` : ''}${tag ? `/tags/${tag}` : ''}/feed/atom/`,
    },
    author: {
      name: siteIdentity.author.name,
      email: siteIdentity.author.email,
      link: siteIdentity.author.url,
    },
    // Intentionally no `stylesheet` / `<?xml-stylesheet?>`: browsers are
    // deprecating XSLT for XML documents (Chrome et al.); aggregators ignore it.
  })

  for (const post of feedPosts) {
    const itemCategories = catalog.getTagsByName(post.tags).map((t) => ({
      name: t.name,
      domain: joinUrl(siteIdentity.website, `/tags/${t.slug}`),
      scheme: 'https',
      term: t.name,
    }))
    const postCategory = catalog.getCategoryByName(post.category)
    if (postCategory !== undefined) {
      itemCategories.push({
        name: postCategory.name,
        domain: joinUrl(siteIdentity.website, `/cats/${postCategory.slug}`),
        scheme: 'https',
        term: postCategory.name,
      })
    }
    feed.addItem({
      title: post.title,
      id: joinUrl(siteIdentity.website, post.permalink),
      link: joinUrl(siteIdentity.website, post.permalink),
      description: post.summary,
      content: await renderEntryContent(post),
      author: [
        {
          name: siteIdentity.author.name,
          email: siteIdentity.author.email,
          link: siteIdentity.author.url,
        },
      ],
      date: post.date,
      image: joinUrl(siteIdentity.website, `/images/og/${post.slug}.png`),
      category: itemCategories,
    })
  }

  for (const cat of catalog.categories) {
    feed.addCategory(cat.name)
  }

  return {
    rss: feed.rss2(),
    // Hotfix the adding the xml:lang attribute to the atom feed
    atom: feed
      .atom1()
      .replace(
        '<feed xmlns="http://www.w3.org/2005/Atom">',
        '<feed xml:lang="zh-CN" xmlns="http://www.w3.org/2005/Atom">',
      ),
  }
}

function selectFeedPosts(
  catalog: ContentCatalog,
  options: Pick<FeedOptions, 'category' | 'tag'> & {
    includeHidden: boolean
    includeScheduled: boolean
  },
): Post[] {
  const visibility = {
    includeHidden: options.includeHidden,
    includeScheduled: options.includeScheduled,
  }

  if (options.category !== undefined) {
    const category = catalog.getCategoryBySlug(options.category) ?? catalog.getCategoryByName(options.category)
    if (category === undefined) {
      return []
    }
    return catalog.getPostsByTaxonomy({ categoryName: category.name }, visibility)
  }

  if (options.tag !== undefined) {
    const tag = catalog.getTagBySlug(options.tag) ?? catalog.getTagByName(options.tag)
    if (tag === undefined) {
      return []
    }
    return catalog.getPostsByTaxonomy({ tagName: tag.name }, visibility)
  }

  return catalog.getPosts(visibility)
}
