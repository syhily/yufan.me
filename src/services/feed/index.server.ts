import { Feed } from 'feed'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import config from '@/blog.config'
import { MusicPlayer } from '@/components/mdx/music/MusicPlayer'
import { Friends } from '@/components/mdx/page/Friends'
import { Solution } from '@/components/mdx/solutions/Solution'
import { getCategories, getCategory, getPosts, getTag, type Page, type Post } from '@/services/catalog/schema'
import { joinUrl } from '@/shared/urls'

export interface FeedOptions {
  hidden?: boolean
  schedule?: boolean
  size?: number
  category?: string
  tag?: string
}

function renderEntryContent(entry: Post | Page): string {
  const Body = entry.body
  return renderToStaticMarkup(createElement(Body, { components: { Friends, MusicPlayer, Solution } }))
}

export async function generateFeeds(options: FeedOptions = {}) {
  const { hidden = false, schedule = false, size = config.settings.feed.size, category, tag } = options
  if (category !== undefined && tag !== undefined) {
    throw new Error('Category and tag cannot be specified at the same time')
  }
  const allPosts = await getPosts({ hidden, schedule })
  const filtered: typeof allPosts = []
  for (const post of allPosts) {
    if (category !== undefined) {
      const cat = await getCategory(post.category)
      if (cat?.slug !== category && post.category !== category) continue
    }
    if (tag !== undefined) {
      const slugs = await Promise.all(post.tags.map(async (t) => (await getTag(t))?.slug))
      if (!slugs.includes(tag) && !post.tags.includes(tag)) continue
    }
    filtered.push(post)
  }
  const feedPosts = filtered.length < size ? filtered : filtered.slice(0, size)

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
    stylesheet: `${import.meta.env.SITE}/feed.xsl`,
  })

  for (const post of feedPosts) {
    const tagEntries = await Promise.all(post.tags.map((t) => getTag(t)))
    const itemCategories = tagEntries
      .filter((t) => t !== undefined)
      .map((t) => ({
        name: t!.name,
        domain: joinUrl(config.website, `/tags/${t!.slug}`),
        scheme: 'https',
        term: t!.name,
      }))
    const postCategory = await getCategory(post.category)
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
      content: renderEntryContent(post),
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

  const allCategories = await getCategories()
  for (const cat of allCategories) {
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
