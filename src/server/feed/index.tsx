import { Feed } from 'feed'

import config from '@/blog.config'
import { ContentCatalog, type Page, type Post } from '@/server/catalog'
import { prerenderToHtml } from '@/server/catalog/render'
import { enhanceImageHtml } from '@/server/images/thumbhash'
import { joinUrl } from '@/shared/urls'
import { MusicPlayer } from '@/ui/mdx/music/MusicPlayer'
import { Friends } from '@/ui/mdx/page/Friends'
import { Solution } from '@/ui/mdx/solutions/Solution'

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
  const Body = entry.body
  // Feed items still ship as HTML (RSS/Atom can't carry a React tree), so
  // we keep the prerender + `enhanceImageHtml` pipeline for syndication.
  // Detail-page routes bypass this entirely and render the MDX body as a
  // live React subtree.
  const html = await prerenderToHtml(<Body components={{ Friends, MusicPlayer, Solution }} />)
  return enhanceImageHtml(html)
}

export async function generateFeeds(options: FeedOptions = {}) {
  const { includeHidden = true, includeScheduled = false, size = config.settings.feed.size, category, tag } = options
  if (category !== undefined && tag !== undefined) {
    throw new Error('Category and tag cannot be specified at the same time')
  }
  const catalog = await ContentCatalog.get()
  const filtered = selectFeedPosts(catalog, { includeHidden, includeScheduled, category, tag })
  const feedPosts = filtered.slice(0, size)

  // Start to build the feed.
  const feed = new Feed({
    title: config.title,
    description: config.description,
    id: config.website,
    link: config.website,
    language: 'zh-CN',
    image: joinUrl(config.website, '/logo.svg'),
    favicon: joinUrl(config.website, '/favicon.svg'),
    copyright: `All rights reserved ${config.settings.footer.initialYear}, ${config.author.name}`,
    updated: new Date(),
    generator: 'WordPress 3.2.1',
    feedLinks: {
      rss: `${config.website}${category ? `/cats/${category}` : ''}${tag ? `/tags/${tag}` : ''}/feed`,
      atom: `${config.website}${category ? `/cats/${category}` : ''}${tag ? `/tags/${tag}` : ''}/feed/atom/`,
    },
    author: {
      name: config.author.name,
      email: config.author.email,
      link: config.author.url,
    },
    stylesheet: `${config.website}/feed.xsl`,
  })

  for (const post of feedPosts) {
    const itemCategories = catalog.getTagsByName(post.tags).map((t) => ({
      name: t.name,
      domain: joinUrl(config.website, `/tags/${t.slug}`),
      scheme: 'https',
      term: t.name,
    }))
    const postCategory = catalog.getCategoryByName(post.category)
    if (postCategory !== undefined) {
      itemCategories.push({
        name: postCategory.name,
        domain: joinUrl(config.website, `/cats/${postCategory.slug}`),
        scheme: 'https',
        term: postCategory.name,
      })
    }
    feed.addItem({
      title: post.title,
      id: joinUrl(config.website, post.permalink),
      link: joinUrl(config.website, post.permalink),
      description: post.summary,
      content: await renderEntryContent(post),
      author: [
        {
          name: config.author.name,
          email: config.author.email,
          link: config.author.url,
        },
      ],
      date: post.date,
      image: joinUrl(config.website, `/images/og/${post.slug}.png`),
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
