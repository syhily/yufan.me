import { defineMiddleware, sequence } from 'astro:middleware'
import { posts } from '@/helpers/schema'
import { urlJoin } from '@/helpers/tools'

const AUTH_ENDPOINTS = {
  login: '/admin/login',
  logout: '/admin/logout',
}

const adminAuthn = defineMiddleware(async ({ url: { pathname }, redirect, session }, next) => {
  if (session === undefined) {
    throw new Error('Astro session is required to be enabled')
  }
  if (pathname === AUTH_ENDPOINTS.login
    || pathname === AUTH_ENDPOINTS.logout
    || pathname === `${AUTH_ENDPOINTS.login}/`
    || pathname === `${AUTH_ENDPOINTS.logout}/`) {
    // Bypass the login/logout actions. Support traveling slash in request path.
    return next()
  }
  if (pathname.startsWith('/admin/') || pathname === '/admin') {
    // Require user information in session.
    const user = await session.get('user')
    if (user === undefined) {
      return redirect(AUTH_ENDPOINTS.login)
    }
  }
  // return a Response or the result of calling `next()`
  return next()
})

const postUrlMappings: Map<string, string> = posts.map(post => ({
  sources: [
    urlJoin('/', post.slug),
    ...post.alias.flatMap(alias => [urlJoin('/', alias), urlJoin('/posts/', alias)]),
  ],
  target: post.permalink,
})).reduce((res, item) => {
  item.sources.forEach((source) => {
    // Avoid duplicated alias
    if (res.has(source)) {
      throw new Error(`Duplicate request path ${source} in post alias slug`)
    }
    // Avoid admin endpoints
    if (source.startsWith('/admin/')
      || source === '/admin'
      || source === AUTH_ENDPOINTS.login
      || source === AUTH_ENDPOINTS.logout
      || source === `${AUTH_ENDPOINTS.login}/`
      || source === `${AUTH_ENDPOINTS.logout}/`) {
      throw new Error(`Preserved request path: ${source}`)
    }
    res.set(source, item.target)
  })
  return res
}, new Map<string, string>())

const postUrlRedirect = defineMiddleware(({ request: { method }, url: { pathname }, redirect }, next) => {
  // This is used for redirect my old blog posts to a new mapping.
  const newTarget = postUrlMappings.get(pathname.endsWith('/') ? pathname.substring(0, pathname.length - 1) : pathname)
  if (method === 'GET' && newTarget !== undefined) {
    return redirect(newTarget, 301)
  }
  // return a Response or the result of calling `next()`
  return next()
})

// Chained Middleware.
export const onRequest = sequence(adminAuthn, postUrlRedirect)
