import PostContent from '@/components/page/post/PostContent.astro';
import { options, posts } from '@/helpers/schema';
import rss from '@astrojs/rss';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import sanitize from 'sanitize-html';

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
      value = sanitize(value, {
        allowedTags: sanitize.defaults.allowedTags.concat(['img']),
      });
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
