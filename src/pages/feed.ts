import { options, posts } from '@/helpers/schema';
import rss from '@astrojs/rss';

export const GET = async () => {
  // TODO Support full content {options.settings.feed.full}
  // See https://github.com/withastro/roadmap/discussions/419

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
      categories: [post.category, ...post.tags],
    })),
  });
};
