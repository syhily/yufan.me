import type { AstroSession } from 'astro'

import { makeToken, timingSafeEqual } from '@/helpers/tools'

// The token is valid only in five minutes.
const TOKEN_TTL = 60 * 5 * 1000
const TOKEN_LENGTH = 48

export function generateToken(session: AstroSession): string {
  const token = makeToken(TOKEN_LENGTH)
  const timestamp = Date.now()
  session.set('csrf', { token, timestamp })
  return token
}

export async function validateToken(session: AstroSession, token: string): Promise<[boolean, string]> {
  const csrf = await session.get('csrf')
  if (csrf === undefined) {
    return [false, 'No csrf token existed in session']
  }
  // Always consume the stored token to prevent replay.
  session.delete('csrf')
  if (csrf.timestamp + TOKEN_TTL < Date.now()) {
    return [false, 'The token is expired']
  }
  if (timingSafeEqual(csrf.token, token)) {
    return [true, '']
  }
  return [false, 'csrf token mismatch']
}
