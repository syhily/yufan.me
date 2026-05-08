import { createMiddleware } from 'hono/factory'

import { getLogger } from '@/server/infra/logger'
import { getInstallState } from '@/server/settings/install/gate'
import { hydrateBlogSettings } from '@/server/settings/snapshot'

import type { Env } from './context'

const log = getLogger('install.gate')

const EXEMPT_PATHS = new Set(['/wp-login.php', '/wp-admin/install.php', '/wp-admin/install/settings.php'])

const EXEMPT_PATH_PREFIXES = [
  '/assets/',
  '/build/',
  '/fonts/',
  '/images/',
  '/favicon',
  '/robots.txt',
  '/sitemap.xml',
  '/__manifest',
]

function isExempt(pathname: string): boolean {
  if (EXEMPT_PATHS.has(pathname)) {
    return true
  }
  return EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export const honoInstallGateMiddleware = createMiddleware<Env>(async (c, next) => {
  const url = new URL(c.req.url)

  try {
    await hydrateBlogSettings()
  } catch (error) {
    log.error('Install gate failed to hydrate settings; letting request through', { error })
    return next()
  }

  if (isExempt(url.pathname)) {
    return next()
  }

  let state: Awaited<ReturnType<typeof getInstallState>>
  try {
    state = await getInstallState()
  } catch (error) {
    log.error('Install gate failed to determine install state; letting request through', { error })
    return next()
  }

  if (state === 'installed') {
    return next()
  }
  if (state === 'noAdmin') {
    return c.redirect('/wp-admin/install.php', 303)
  }
  return c.redirect('/wp-admin/install/settings.php', 303)
})
