// WordPress probe detector. Only `/wp-login.php` is implemented today; the
// `/wp-admin` and `/wp-admin/install.php` entries stay in the allowlist so
// those reserved paths do not get the "Not WordPress" treatment if probed
// (they still 404 through normal routing + catalog until pages return).
// Every other request that *looks* like a WordPress install is almost
// certainly an automated scanner. We answer those with a HTTP 404 plus a
// custom "this is not a WordPress site" view rather than the generic 404.
//
// The marker (`statusText: "Not WordPress"`) is what `src/root.tsx`
// `ErrorBoundary` reads to switch from the regular 404 view to
// `<NotWordPressView />`.

const LEGIT_WP_PATHS = new Set(['/wp-login.php', '/wp-admin', '/wp-admin/install.php'])

export function isWordPressDecoyPath(pathname: string): boolean {
  if (LEGIT_WP_PATHS.has(pathname)) {
    return false
  }

  if (pathname.startsWith('/wp-admin/')) {
    return true
  }
  if (pathname.startsWith('/wp-content/')) {
    return true
  }
  if (pathname.startsWith('/wp-includes/')) {
    return true
  }
  if (pathname === '/cgi-bin' || pathname.startsWith('/cgi-bin/')) {
    return true
  }
  if (pathname.endsWith('.php')) {
    return true
  }

  return false
}

export function notWordPressSite(): never {
  throw new Response('Not WordPress', { status: 404, statusText: 'Not WordPress' })
}

export const NOT_WORDPRESS_STATUS_TEXT = 'Not WordPress'
