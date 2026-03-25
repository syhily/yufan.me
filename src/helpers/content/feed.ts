import { joinPaths } from '@astrojs/internal-helpers/path'
import config from '@/blog.config'
import { renderPostsContents } from '@/helpers/content/render'
import { categories, getCategory, getPosts, getTag } from '@/helpers/content/schema'
import { Feed } from "feed";

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
  const visiblePosts = getPosts({ hidden, schedule })
    .filter(post => category === undefined || getCategory(post.category)?.slug === category || post.category === category)
    .filter(post => tag === undefined || post.tags.map(tag => getTag(tag)?.slug).includes(tag) || post.tags.includes(tag))
  const feedPosts = visiblePosts.length < size ? visiblePosts : visiblePosts.slice(0, size)
  const contents = await renderPostsContents(feedPosts)

  // Start to build the feed.
  const feed = new Feed({
    title: config.title,
    description: config.description,
    id: config.website,
    link: config.website,
    language: "zh-CN",
    image: `${import.meta.env.SITE}/logo.svg`,
    favicon: `${import.meta.env.SITE}/favicon.svg`,
    copyright: `All rights reserved ${config.settings.footer.initialYear}, ${config.author.name}`,
    updated: new Date(),
    generator: "WordPress 3.2.1",
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

  // Add all the posts to the feed
  feedPosts.forEach(post => {
    const categories = post.tags.map(tag => getTag(tag)).filter(tag => tag !== undefined)
      .map(tag => ({
        name: tag.name,
        domain: joinPaths(import.meta.env.SITE, `/tags/${tag.slug}`),
        scheme: 'https',
        term: tag.name,
      }))
    const category = getCategory(post.category)
    if (category !== undefined) {
      categories.push({
        name: category.name,
        domain: joinPaths(import.meta.env.SITE, `/cats/${category.slug}`),
        scheme: 'https',
        term: category.name,
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
      category: categories,
    })
  })

  // Add available categories to the feed
  categories.forEach(category => {
    feed.addCategory(category.name)
  })

  return {
    rss: feed.rss2(),
    // Hotfix the adding the xml:lang attribute to the atom feed
    atom: feed.atom1().replace('<feed xmlns="http://www.w3.org/2005/Atom">', '<feed xml:lang="zh-CN" xmlns="http://www.w3.org/2005/Atom">'),
  }
}
