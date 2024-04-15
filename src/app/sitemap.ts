import { options, pages, posts } from '#site/content';

export default async function sitemap() {
  const blogs = posts.map((post) => ({
    url: options.website + post.permalink,
    modifiedTime: post.updated ?? post.date,
  }));
  const routers = pages.map((page) => ({
    url: options.website + page.permalink,
    modifiedTime: page.updated ?? page.date,
  }));

  return [...routers, ...blogs];
}
