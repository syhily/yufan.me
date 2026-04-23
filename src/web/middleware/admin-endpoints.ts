// Centralised constants describing the WordPress-style admin endpoints we
// expose for the install + login flow. Kept separate from the middleware
// implementations so multiple files (auth, fresh-install, honeypot rules)
// can share them without circular imports.

export enum ADMIN_ENDPOINTS {
  install = '/wp-admin/install.php',
  login = '/wp-login.php',
}

export function isAdminEndpoint(endpoint: string): boolean {
  return Object.values<string>(ADMIN_ENDPOINTS).includes(endpoint)
}

export function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/wp-admin/') || pathname === '/wp-admin'
}
