import type { BlogSession } from '@/services/auth/session.server'

import { makeToken, timingSafeEqual } from '@/shared/security'

// The token is valid only in five minutes.
const TOKEN_TTL = 60 * 5 * 1000
const TOKEN_LENGTH = 48

export function generateToken(session: BlogSession): string {
  const token = makeToken(TOKEN_LENGTH)
  const timestamp = Date.now()
  session.set('csrf', { token, timestamp })
  return token
}

export function validateToken(session: BlogSession, token: string): [boolean, string] {
  const csrf = session.get('csrf')
  if (csrf === undefined) {
    return [false, 'No csrf token existed in session']
  }
  // Always consume the stored token to prevent replay.
  session.unset('csrf')
  if (csrf.timestamp + TOKEN_TTL < Date.now()) {
    return [false, 'The token is expired']
  }
  if (timingSafeEqual(csrf.token, token)) {
    return [true, '']
  }
  return [false, 'csrf token mismatch']
}
