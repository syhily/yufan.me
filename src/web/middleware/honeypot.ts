import { defineMiddleware } from 'astro:middleware'

// Honeypot — pretends to be an old Apache/PHP stack so noisy WordPress and
// PHP scanners that fingerprint headers don't realise this is an Astro site.
// Disable by removing this from the chain in `src/middleware.ts`.
export const apacheHoneypot = defineMiddleware(async (_, next) => {
  const response = await next()
  const headers = new Headers(response.headers)
  headers.set('Server', 'Apache/2.0.64')
  headers.set('X-Powered-By', 'PHP/5.3.29')
  headers.set('Date', new Date().toUTCString())
  headers.set('Accept-Ranges', 'bytes')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
})
