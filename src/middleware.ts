import { defineMiddleware } from 'astro:middleware'
import { posts } from '@/helpers/schema'
import { urlJoin } from '@/helpers/tools'

const mappings = new Map<string, string>()

const rewrites = posts.map(post => ({
  sources: [
    urlJoin('/', post.slug),
    ...post.alias.flatMap(alias => [urlJoin('/', alias), urlJoin('/posts/', alias)]),
  ],
  target: post.permalink,
}))

for (const rewrite of rewrites) {
  for (const source of rewrite.sources) {
    mappings.set(source, rewrite.target)
  }
}

export const onRequest = defineMiddleware(({ request: { method }, url: { pathname }, redirect }, next) => {
  // This is used for redirect my old blog posts to a new mapping.
  const newTarget = mappings.get(pathname.endsWith('/') ? pathname.substring(0, pathname.length - 1) : pathname)
  if (method === 'GET' && newTarget !== undefined) {
    return redirect(newTarget, 301)
  }

  // return a Response or the result of calling `next()`
  return next()
})
