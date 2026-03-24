import { joinPaths } from '@astrojs/internal-helpers/path'
import config from '@/blog.config'
import { renderPostsContents } from '@/helpers/content/render'
import { categories, getCategory, getPosts, getTag } from '@/helpers/content/schema'
import { Feed } from "feed";

async function generateFeeds() {
  const visiblePosts = getPosts({ hidden: false, schedule: false })
  const feedPosts
    = visiblePosts.length < config.settings.feed.size ? visiblePosts : visiblePosts.slice(0, config.settings.feed.size)
  const contents = await renderPostsContents(feedPosts)

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
      rss: `${import.meta.env.SITE}/feed/`,
      atom: `${import.meta.env.SITE}/feed/atom/`,
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
      image: post.cover,
      category: categories,
    })
  })

  // Add available categories to the feed
  categories.forEach(category => {
    feed.addCategory(category.name)
  })

  return feed
}

// Cached for avoiding generating feeds multiple times
export const FEED = await generateFeeds()
