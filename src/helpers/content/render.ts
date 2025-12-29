import type { ContainerRenderOptions } from 'astro/container'
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import type { TextNode } from 'ultrahtml'
import type { Post } from '@/helpers/content/schema'
import { joinPaths } from '@astrojs/internal-helpers/path'
import { getContainerRenderer } from '@astrojs/mdx'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { loadRenderers } from 'astro:container'
import { REDIS_URL } from 'astro:env/server'
import { ELEMENT_NODE, TEXT_NODE, transform, walk } from 'ultrahtml'
import sanitize from 'ultrahtml/transformers/sanitize'
import config from '@/blog.config'
import PostContent from '@/components/page/post/PostContent.astro'

const renderers = await loadRenderers([getContainerRenderer()])
const container = await AstroContainer.create({
  astroConfig: {
    session: {
      driver: 'redis',
      ttl: 60 * 60,
      options: {
        url: REDIS_URL,
      },
      cookie: {
        name: 'yufan-me-session',
        sameSite: 'lax',
        secure: true,
      },
    },
  },
  renderers,
})

// We only want to make sure the container instance is singleton.
export async function partialRender(component: AstroComponentFactory, options?: ContainerRenderOptions): Promise<string> {
  return await container.renderToString(component, { ...options, partial: true })
}

async function cleanupContent(html: string) {
  return await transform(html, [
    async (node) => {
      await walk(node, (node) => {
        if (node.type === ELEMENT_NODE) {
          // Make sure images are absolute, some readers are not smart enough to figure it out
          if (node.name === 'img' && node.attributes.src?.startsWith('/')) {
            node.attributes.src = joinPaths(import.meta.env.SITE, node.attributes.src)
            const { src, alt } = node.attributes
            node.attributes = { src, alt }
          }

          // Make sure links are absolute, some readers are not smart enough to figure it out
          if (node.name === 'a') {
            if (node.attributes.href?.startsWith('/')) {
              node.attributes.href = joinPaths(import.meta.env.SITE, node.attributes.href)
            }
            const { href, title } = node.attributes
            const attributes: Record<string, string> = { href }
            if (typeof title !== 'undefined') {
              attributes.title = title
            }
            node.attributes = attributes

            // Remove inner links.
            if (href.startsWith('#')) {
              const code = node as unknown as TextNode
              code.type = TEXT_NODE
              code.value = ''
            }
          }

          // Remove favicon images, some readers don't know they should be inline and it ends up being a broken image
          if ('data-favicon' in node.attributes || 'data-favicon-span' in node.attributes) {
            const favicon = node as unknown as TextNode
            favicon.type = TEXT_NODE
            favicon.value = ''
          }

          // Remove EC buttons
          if (node.attributes['data-code']) {
            const code = node as unknown as TextNode
            code.type = TEXT_NODE
            code.value = ''
          }
        }
      })

      return node
    },
    sanitize({
      dropElements: ['style'],
      dropAttributes: {
        'class': ['*'],
        'data-astro-source': ['*'],
        'data-astro-source-loc': ['*'],
        'data-astro-source-file': ['*'],
        'data-favicon': ['*'],
        'data-image-component': ['img'],
        'style': ['*'],
        'data-language': ['*'],
        'data-footnotes': ['*'],
      },
      allowCustomElements: true,
      allowComments: false,
    }),
  ])
}

export async function renderPostsContents(feedPosts: Post[]): Promise<Map<string, string>> {
  const contents = new Map<string, string>()

  if (config.settings.feed.full) {
    const promises = feedPosts.map(async post => ({
      key: post.slug,
      value: await partialRender(PostContent, {
        props: {
          slug: post.slug,
        },
      }),
    }))

    for (const { key, value } of await Promise.all(promises)) {
      contents.set(key, await cleanupContent(value))
    }
  }

  return contents
}
