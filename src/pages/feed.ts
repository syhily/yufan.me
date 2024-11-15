import PostContent from '@/components/page/post/PostContent.astro';
import { partialRender } from '@/helpers/container';
import { posts, type Post } from '@/helpers/schema';
import { urlJoin } from '@/helpers/tools';
import options from '@/options';
import rss from '@astrojs/rss';
import { ELEMENT_NODE, TEXT_NODE, transform, walk, type TextNode } from 'ultrahtml';
import sanitize from 'ultrahtml/transformers/sanitize';

const cleanupContent = async (html: string) => {
  return await transform(html, [
    async (node) => {
      await walk(node, (node) => {
        if (node.type === ELEMENT_NODE) {
          // Make sure images are absolute, some readers are not smart enough to figure it out
          if (node.name === 'img' && node.attributes.src?.startsWith('/')) {
            node.attributes.src = urlJoin(options.assetsPrefix(), node.attributes.src);
            const { src, alt } = node.attributes;
            node.attributes = { src, alt };
          }

          // Make sure links are absolute, some readers are not smart enough to figure it out
          if (node.name === 'a') {
            if (node.attributes.href?.startsWith('/')) {
              node.attributes.href = urlJoin(import.meta.env.SITE, node.attributes.href);
            }
            const { href, title } = node.attributes;
            const attributes: Record<string, string> = { href };
            if (typeof title !== 'undefined') {
              attributes.title = title;
            }
            node.attributes = attributes;

            // Remove inner links.
            if (href.startsWith('#')) {
              const code = node as unknown as TextNode;
              code.type = TEXT_NODE;
              code.value = '';
            }
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
        style: ['*'],
        'data-language': ['*'],
        'data-footnotes': ['*'],
      },
      allowCustomElements: false,
      allowComments: false,
    }),
  ]);
};

const renderPostsContent = async (feedPosts: Post[]): Promise<Map<string, string>> => {
  const contents = new Map<string, string>();

  if (options.settings.feed.full) {
    const promises = feedPosts.map(async (post) => ({
      key: post.slug,
      value: await partialRender(PostContent, {
        props: {
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
      author: `${options.author.email} (${options.author.name})`,
      content: contents.get(post.slug) ?? post.summary,
      categories: [post.category, ...post.tags],
    })),
  });
};

// The rss reader may prefetch by using HEAD method.
export const HEAD = async () => {
  return new Response('', {
    headers: {
      Host: import.meta.env.SITE,
      'Content-Type': 'application/xml',
      Accept: '*/*',
      Connection: 'keep-alive',
    },
  });
};
