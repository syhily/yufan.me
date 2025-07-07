import { defineMiddleware, sequence } from 'astro:middleware'
import { hasAdmin } from '@/helpers/auth/query'
import { posts } from '@/helpers/schema'
import { urlJoin } from '@/helpers/tools'

enum ADMIN_ENDPOINTS {
  install = '/admin/install',
  login = '/admin/login',
  logout = '/admin/logout',
}

function isAdminEndpoints(endpoint: string) {
  return endpoint === ADMIN_ENDPOINTS.login
    || endpoint === ADMIN_ENDPOINTS.logout
    || endpoint === ADMIN_ENDPOINTS.install
    || endpoint === `${ADMIN_ENDPOINTS.login}/`
    || endpoint === `${ADMIN_ENDPOINTS.logout}/`
    || endpoint === `${ADMIN_ENDPOINTS.install}/`
}

const freshInstall = defineMiddleware(async ({ url: { pathname }, redirect }, next) => {
  const installed = await hasAdmin()
  const accessInstall = pathname === ADMIN_ENDPOINTS.install || pathname === `${ADMIN_ENDPOINTS.install}/`
  if (installed) {
    return accessInstall ? redirect('/') : next()
  }
  else {
    return accessInstall ? next() : redirect(ADMIN_ENDPOINTS.install)
  }
})

const authentication = defineMiddleware(async ({ url: { pathname }, redirect, session }, next) => {
  if (session === undefined) {
    throw new Error('Astro session is required to be enabled')
  }
  // Bypass the login/logout actions. Support traveling slash in request path.
  if (isAdminEndpoints(pathname)) {
    return next()
  }
  if (pathname.startsWith('/admin/') || pathname === '/admin') {
    // Require user information in session.
    const user = await session.get('user')
    if (user === undefined) {
      return redirect(ADMIN_ENDPOINTS.login)
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
      || isAdminEndpoints(source)) {
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
export const onRequest = sequence(freshInstall, authentication, postUrlRedirect)
