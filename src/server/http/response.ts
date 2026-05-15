// Lightweight response helpers. Every controller handler returns
// `{ status, body }` but the patterns are duplicated 200+ times.
// These reduce boilerplate and make error shapes consistent.

function errorBody(message: string) {
  return { error: { message } }
}

export function ok<T>(body: T) {
  return { status: 200 as const, body }
}

export function created<T>(body: T) {
  return { status: 201 as const, body }
}

export function noContent() {
  return { status: 204 as const, body: undefined }
}

export function badRequest(message: string) {
  return { status: 400 as const, body: errorBody(message) }
}

export function unauthorized(message = '未登录') {
  return { status: 401 as const, body: errorBody(message) }
}

export function forbidden(message = '权限不足') {
  return { status: 403 as const, body: errorBody(message) }
}

export function notFound(message = '资源不存在') {
  return { status: 404 as const, body: errorBody(message) }
}

export function conflict(message: string) {
  return { status: 409 as const, body: errorBody(message) }
}

export function rateLimited(message = '请求过于频繁，请稍后再试') {
  return { status: 429 as const, body: errorBody(message) }
}

export function internalError(message = '服务器内部错误') {
  return { status: 500 as const, body: errorBody(message) }
}
