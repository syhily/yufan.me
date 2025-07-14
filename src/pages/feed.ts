import rss from '@astrojs/rss'
import { renderPostsContents } from '@/helpers/content/render'
import { posts } from '@/helpers/content/schema'
import { urlJoin } from '@/helpers/tools'
import options from '@/options'

export async function GET() {
  const visiblePosts = posts.filter(post => post.visible)
  const feedPosts
    = visiblePosts.length < options.settings.feed.size ? visiblePosts : visiblePosts.slice(0, options.settings.feed.size)
  const contents = await renderPostsContents(feedPosts)

  return rss({
    title: options.title,
    description: options.description,
    stylesheet: '/feed.xsl',
    site: import.meta.env.SITE,
    items: feedPosts.map(post => ({
      link: urlJoin(import.meta.env.SITE, post.permalink),
      title: post.title,
      pubDate: post.date,
      description: post.summary,
      author: `${options.author.email} (${options.author.name})`,
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
