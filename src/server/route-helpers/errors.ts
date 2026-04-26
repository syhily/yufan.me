// One error vocabulary, shared by services and resource-route handlers.
//
// We have two error shapes because they answer different questions:
//
//   * `DomainError` is thrown by services / repositories. It carries a
//     framework-neutral *code* (`NOT_FOUND`, `CONFLICT`, …) so callers can
//     branch without coupling to HTTP. The route perimeter (`runApi`) is
//     the only place that translates the code to a status.
//   * `ActionFailure` is thrown by API handlers when they want to dictate
//     the HTTP status directly (e.g. the schema parser returning 400, or a
//     handler returning 500 because a downstream UPDATE returned no rows).
//     It can also carry per-issue Zod paths and `Set-Cookie` headers.
//
// `DomainError(code)` defaults the user-visible message from `DEFAULT_MESSAGES`
// below — most call sites used to read the same `ErrorMessages.X` constant
// and could now just `throw new DomainError("CONFLICT")`. Sites that need a
// custom message (e.g. dynamic IDs) can still pass one.
//
// The `ErrorMessages` bag below is the minimal set of *shared* user-visible
// strings. One-off messages should be inlined at their throw site so the
// translated copy lives next to the business logic that triggers it.

// -----------------------------------------------------------------------------
// Domain error codes
// -----------------------------------------------------------------------------

export const DOMAIN_ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL',
] as const

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number]

// HTTP status code each domain code translates to. The route perimeter calls
// `domainStatus(code)` once per failure, so keeping this as a literal `Record`
// (rather than a `switch`) lets V8 inline the lookup.
const DOMAIN_STATUS: Record<DomainErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
}

export function domainStatus(error: DomainError): number {
  return DOMAIN_STATUS[error.code]
}

// Default user-visible message for each code. `new DomainError("FORBIDDEN")`
// will surface "禁止访问。" unless the call site provides something more
// specific. These are intentionally generic — service-layer messages that
// describe a *specific* failure should pass the message explicitly so the
// reader of the code sees the same string the user will.
const DEFAULT_MESSAGES: Record<DomainErrorCode, string> = {
  BAD_REQUEST: '请求参数无效。',
  UNAUTHORIZED: '需要登录后再操作。',
  FORBIDDEN: '禁止访问。',
  NOT_FOUND: '资源不存在。',
  CONFLICT: '操作与当前状态冲突。',
  RATE_LIMITED: '请求过于频繁，请稍后再试。',
  INTERNAL: '服务器内部错误。',
}

// Error thrown by services / repositories. Route actions and resource routes
// translate it into HTTP responses without coupling the service layer to a
// framework-specific transport. Pass `message` only when you need something
// more specific than the per-code default.
export class DomainError extends Error {
  readonly code: DomainErrorCode

  constructor(code: DomainErrorCode, message?: string) {
    super(message ?? DEFAULT_MESSAGES[code])
    this.code = code
    this.name = 'DomainError'
  }
}

// -----------------------------------------------------------------------------
// API-handler failures
// -----------------------------------------------------------------------------

// Thrown by API handlers (or input parsers) to short-circuit `runApi` with a
// translated `{ error: { message, issues? } }` response. Use this when the
// HTTP status (or extra headers, or Zod issue list) matters more than the
// abstract domain code.
export class ActionFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: { message: string; path?: string[] }[],
    readonly headers?: HeadersInit,
  ) {
    super(message)
    this.name = 'ActionFailure'
  }
}

// -----------------------------------------------------------------------------
// Shared error message bag
// -----------------------------------------------------------------------------

// Strings that appear in 2+ places: keep them here so a copy change updates
// every call site at once, and so tests can pin the canonical UX copy.
// Single-use messages live inline at their throw site.
export const ErrorMessages = {
  /** Surfaced by `requireAdminSession` and asserted by the API contract test. */
  NOT_ADMIN: '当前用户不是管理员。',
} as const
