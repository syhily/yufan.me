// Codes used by `DomainError` and surfaced to the frontend so it can branch
// on a stable string (e.g. show a special toast for rate-limiting) without
// pattern-matching on translated messages.
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

// Error thrown by services / repositories. Route actions and resource routes
// can translate it into HTTP responses without coupling the service layer to
// a framework-specific transport.
export class DomainError extends Error {
  readonly code: DomainErrorCode

  constructor(code: DomainErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'DomainError'
  }
}
