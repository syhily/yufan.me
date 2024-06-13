import PostContent from '@/components/page/post/PostContent.astro';
import { options, posts, type Post } from '@/helpers/schema';
import { urlJoin } from '@/helpers/tools';
import { getContainerRenderer } from '@astrojs/mdx';
import rss from '@astrojs/rss';
import type { AstroRenderer, SSRLoadedRenderer } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { ELEMENT_NODE, TEXT_NODE, transform, walk, type TextNode } from 'ultrahtml';
import sanitize from 'ultrahtml/transformers/sanitize';

const cleanupContent = async (html: string) => {
  const content = html.startsWith('<!DOCTYPE html>') ? html.slice(15) : html;

  return await transform(content, [
    async (node) => {
      await walk(node, (node) => {
        if (node.type === ELEMENT_NODE) {
          // Make sure images are absolute, some readers are not smart enough to figure it out
          if (node.name === 'img' && node.attributes.src?.startsWith('/')) {
            node.attributes.src = urlJoin(import.meta.env.SITE, node.attributes.src);
          }

          // Make sure links are absolute, some readers are not smart enough to figure it out
          if (node.name === 'a' && node.attributes.href?.startsWith('/')) {
            node.attributes.href = urlJoin(import.meta.env.SITE, node.attributes.href);
          }

          // Remove favicon images, some readers don't know they should be inline and it ends up being a broken image
          if ('data-favicon' in node.attributes || 'data-favicon-span' in node.attributes) {
            const favicon = node as unknown as TextNode;
            favicon.type = TEXT_NODE;
            favicon.value = '';
          }

          // Remove EC buttons
          if (node.attributes['data-code']) {
            const code = node as unknown as TextNode;
            code.type = TEXT_NODE;
            code.value = '';
          }
        }
      });

      return node;
    },
    sanitize({
      dropAttributes: {
        class: ['*'],
        'data-astro-source': ['*'],
        'data-astro-source-loc': ['*'],
        'data-astro-source-file': ['*'],
        'data-favicon': ['*'],
        'data-image-component': ['img'],
      },
    }),
  ]);
};

// Copy from astro source code. I don't know why this virtual vite module didn't works.
export async function loadRenderers(renderers: AstroRenderer[]) {
  const loadedRenderers = await Promise.all(
    renderers.map(async (renderer) => {
      const mod = await import(/* @vite-ignore */ renderer.serverEntrypoint);
      if (typeof mod.default !== 'undefined') {
        return {
          ...renderer,
          ssr: mod.default,
        } as SSRLoadedRenderer;
      }
      return undefined;
    }),
  );

  return loadedRenderers.filter((r): r is SSRLoadedRenderer => Boolean(r));
}

const renderPostsContent = async (feedPosts: Post[]): Promise<Map<string, string>> => {
  const contents = new Map<string, string>();

  if (options.settings.feed.full) {
    const renderers = await loadRenderers([getContainerRenderer()]);
    const container = await AstroContainer.create({ renderers: renderers });
    const promises = feedPosts.map(async (post) => ({
      key: post.slug,
      value: await container.renderToString(PostContent, {
        params: {
          slug: post.slug,
        },
      }),
    }));

    for (const { key, value } of await Promise.all(promises)) {
      contents.set(key, await cleanupContent(value));
    }
  }

  return contents;
};

export const GET = async () => {
  const feedPosts = posts.length < options.settings.feed.size ? posts : posts.slice(0, options.settings.feed.size);
  const contents = await renderPostsContent(feedPosts);

  return rss({
    title: options.title,
    description: options.description,
    stylesheet: '/feed.xsl',
    site: import.meta.env.SITE,
    items: feedPosts.map((post) => ({
      link: urlJoin(import.meta.env.SITE, post.permalink),
      title: post.title,
      pubDate: post.date,
      description: post.summary,
      author: options.author.name,
      content: contents.get(post.slug) ?? post.summary,
      categories: [post.category, ...post.tags],
    })),
  });
};
