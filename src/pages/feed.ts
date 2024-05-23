import PostContent from '@/components/page/post/PostContent.astro';
import { options, posts } from '@/helpers/schema';
import rss from '@astrojs/rss';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { ELEMENT_NODE, TEXT_NODE, transform, walk, type TextNode } from 'ultrahtml';
import sanitize from 'ultrahtml/transformers/sanitize';

export const GET = async () => {
  const contents = new Map<string, string>();
  if (options.settings.feed.full) {
    const container = await AstroContainer.create({
      renderers: [
        {
          name: '@astrojs/mdx',
          serverEntrypoint: 'astro/jsx/server.js',
        },
      ],
    });
    const promises = posts.slice(0, options.settings.feed.size).map(async (post) => ({
      key: post.slug,
      value: await container.renderToString(PostContent, {
        params: {
          slug: post.slug,
        },
      }),
    }));

    for (let { key, value } of await Promise.all(promises)) {
      value = await transform(value.slice(15), [
        async (node) => {
          await walk(node, (node) => {
            if (node.type === ELEMENT_NODE) {
              // Simplify picture elements to img elements, some feeds are struggling with it
              if (node.name === 'picture') {
                if (node.parent.type === ELEMENT_NODE && node.parent.name === 'a') {
                  const imgChildren = node.children.find(
                    (child) => child.type === ELEMENT_NODE && child.name === 'img',
                  );

                  const { src, srcset, sizes, onload, style, ...attributes } = imgChildren?.attributes || {};

                  node.name = 'img';
                  node.attributes = attributes;
                  node.attributes.src = options.website + src;
                }
              }

              // Make sure images are absolute, some readers are not smart enough to figure it out
              if (node.name === 'img' && node.attributes.src?.startsWith('/')) {
                node.attributes.src = options.website + node.attributes.src;
              }

              // Make sure links are absolute, some readers are not smart enough to figure it out
              if (node.name === 'a' && node.attributes.href?.startsWith('/')) {
                node.attributes.href = options.website + node.attributes.href;
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
      contents.set(key, value);
    }
  }

  return rss({
    title: options.title,
    description: options.description,
    stylesheet: '/feed.xsl',
    site: options.website,
    items: posts.slice(0, options.settings.feed.size).map((post) => ({
      link: options.website + post.permalink,
      title: post.title,
      pubDate: post.date,
      description: post.summary,
      author: options.author.name,
      content: options.settings.feed.full ? contents.get(post.slug) : undefined,
      categories: [post.category, ...post.tags],
    })),
  });
};
