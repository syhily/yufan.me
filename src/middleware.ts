import { joinPaths } from '@astrojs/internal-helpers/path'
import { defineMiddleware, sequence } from 'astro:middleware'
import { userSession } from '@/helpers/auth/session'
import { hasAdmin } from '@/helpers/auth/user'
import { getPosts } from '@/helpers/content/schema'

export enum ADMIN_ENDPOINTS {
  install = '/admin/install',
  login = '/admin/login',
  logout = '/admin/logout',
}

function isAdminEndpoints(endpoint: string) {
  return Object.values<string>(ADMIN_ENDPOINTS).includes(endpoint)
}

const freshInstall = defineMiddleware(async (context, next) => {
  const { url: { pathname }, redirect } = context

  if (pathname === ADMIN_ENDPOINTS.install) {
    if (await hasAdmin()) {
      return redirect('/')
    }
  }

  return next()
})

const authentication = defineMiddleware(async ({ url: { pathname }, redirect, session }, next) => {
  if (session === undefined) {
    console.warn('Astro session is required to be enabled')
    return next()
  }
  // Bypass the login/logout actions. Support traveling slash in request path.
  if (isAdminEndpoints(pathname)) {
    return next()
  }
  if (pathname.startsWith('/admin/') || pathname === '/admin') {
    // Require user information in session.
    const user = await userSession(session)
    if (user === undefined) {
      return redirect(ADMIN_ENDPOINTS.login)
    }
  }
  // return a Response or the result of calling `next()`
  return next()
})

const postUrlMappings: Map<string, string> = getPosts({ hidden: true, schedule: false })
  .map(post => ({
    sources: [
      joinPaths('/', post.slug),
      ...post.alias.flatMap(alias => [joinPaths('/', alias), joinPaths('/posts/', alias)]),
    ],
    target: post.permalink,
  }))
  .reduce((res, item) => {
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
