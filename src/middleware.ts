import { sequence } from 'astro:middleware'

import { ADMIN_ENDPOINTS } from '@/web/middleware/admin-endpoints'
import { authentication } from '@/web/middleware/authentication'
import { freshInstall } from '@/web/middleware/fresh-install'
import { apacheHoneypot } from '@/web/middleware/honeypot'
import { postUrlRedirect } from '@/web/middleware/post-redirect'

// Re-export so existing pages that import { ADMIN_ENDPOINTS } from
// '@/middleware' keep compiling. New code should import from
// `@/web/middleware/admin-endpoints` directly.
export { ADMIN_ENDPOINTS }

// Chained Middleware. Order matters:
//  1. freshInstall  — short-circuit the install wizard once an admin exists.
//  2. authentication — gate /wp-admin/* behind a session.
//  3. postUrlRedirect — 301 legacy permalinks to their canonical post URL.
//  4. apacheHoneypot — rewrite outgoing headers to look like Apache/PHP.
export const onRequest = sequence(freshInstall, authentication, postUrlRedirect, apacheHoneypot)
