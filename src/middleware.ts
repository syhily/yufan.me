import { posts } from '@/helpers/schema';
import { urlJoin } from '@/helpers/tools';
import { defineMiddleware } from 'astro:middleware';

const mappings = new Map<string, string>(posts.map((post) => [urlJoin('/', post.slug), post.permalink]));

export const onRequest = defineMiddleware(({ request: { method }, url: { pathname }, redirect }, next) => {
  // This is used for redirect my old blog posts to a new mapping.
  const newTarget = mappings.get(pathname.endsWith('/') ? pathname.substring(0, pathname.length - 1) : pathname);
  if (method === 'GET' && newTarget !== undefined) {
    return redirect(newTarget, 301);
  }

  // return a Response or the result of calling `next()`
  return next();
});
