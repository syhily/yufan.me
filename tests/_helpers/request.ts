// Tiny request factories so tests don't repeat boilerplate Request init
// objects. Every helper encodes the same conventions used by Resource
// Routes — JSON `Content-Type` for body requests, `Accept: application/json`
// for everything we hand to `runApi`.

export function jsonRequest(method: string, body: unknown, url = 'http://localhost/api/test'): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
}

export function getRequest(url = 'http://localhost/api/test'): Request {
  return new Request(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
}

export function htmlRequest(url = 'http://localhost/', method = 'GET'): Request {
  return new Request(url, {
    method,
    headers: { Accept: 'text/html' },
  })
}
