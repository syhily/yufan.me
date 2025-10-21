import { joinPaths } from '@astrojs/internal-helpers/path'
import rss from '@astrojs/rss'
import config from '@/blog.config'
import { renderPostsContents } from '@/helpers/content/render'
import { getPosts } from '@/helpers/content/schema'

export async function GET() {
  const visiblePosts = getPosts({ hidden: false, schedule: false })
  const feedPosts
    = visiblePosts.length < config.settings.feed.size ? visiblePosts : visiblePosts.slice(0, config.settings.feed.size)
  const contents = await renderPostsContents(feedPosts)

  return rss({
    title: config.title,
    description: config.description,
    stylesheet: '/feed.xsl',
    site: import.meta.env.SITE,
    items: feedPosts.map(post => ({
      link: joinPaths(import.meta.env.SITE, post.permalink),
      title: post.title,
      pubDate: post.date,
      description: post.summary,
      author: `${config.author.email} (${config.author.name})`,
      content: contents.get(post.slug) ?? post.summary,
      categories: [post.category, ...post.tags],
    })),
  })
}

// The rss reader may prefetch by using HEAD method.
export async function HEAD() {
  return new Response('', {
    headers: {
      'Host': import.meta.env.SITE,
      'Content-Type': 'application/xml',
      'Accept': '*/*',
      'Connection': 'keep-alive',
    },
  })
}
