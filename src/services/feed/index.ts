import { joinPaths } from '@astrojs/internal-helpers/path'
import { Feed } from 'feed'

import config from '@/blog.config'
import { getCategories, getCategory, getPosts, getTag } from '@/services/catalog/schema'
import { renderPostsContents } from '@/services/markdown/render'

export interface FeedOptions {
  hidden?: boolean
  schedule?: boolean
  size?: number
  category?: string
  tag?: string
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
  const contents = await renderPostsContents(feedPosts)

  // Start to build the feed.
  const feed = new Feed({
    title: config.title,
    description: config.description,
    id: config.website,
    link: config.website,
    language: 'zh-CN',
    image: `${import.meta.env.SITE}/logo.svg`,
    favicon: `${import.meta.env.SITE}/favicon.svg`,
    copyright: `All rights reserved ${config.settings.footer.initialYear}, ${config.author.name}`,
    updated: new Date(),
    generator: 'WordPress 3.2.1',
    feedLinks: {
      rss: `${import.meta.env.SITE}${category ? `/cats/${category}` : ''}${tag ? `/tags/${tag}` : ''}/feed`,
      atom: `${import.meta.env.SITE}${category ? `/cats/${category}` : ''}${tag ? `/tags/${tag}` : ''}/feed/atom/`,
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
        domain: joinPaths(import.meta.env.SITE, `/tags/${t!.slug}`),
        scheme: 'https',
        term: t!.name,
      }))
    const postCategory = await getCategory(post.category)
    if (postCategory !== undefined) {
      itemCategories.push({
        name: postCategory.name,
        domain: joinPaths(import.meta.env.SITE, `/cats/${postCategory.slug}`),
        scheme: 'https',
        term: postCategory.name,
      })
    }
    feed.addItem({
      title: post.title,
      id: joinPaths(import.meta.env.SITE, post.permalink),
      link: joinPaths(import.meta.env.SITE, post.permalink),
      description: post.summary,
      content: contents.get(post.slug) ?? post.summary,
      author: [
        {
          name: config.author.name,
          email: config.author.email,
          link: config.author.url,
        },
      ],
      date: post.date,
      image: `${import.meta.env.SITE}/images/og/${post.slug}.png`,
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
