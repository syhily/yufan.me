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

// Error thrown by services / repositories. Action middleware catches it and
// converts it into Astro's `ActionError` so the existing transport contract
// stays the same. This lets the service layer stay decoupled from
// astro:actions.
export class DomainError extends Error {
  readonly code: DomainErrorCode

  constructor(code: DomainErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'DomainError'
  }
}
