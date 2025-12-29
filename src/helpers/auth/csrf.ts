import type { AstroSession } from 'astro'
import { makeToken } from '@/helpers/tools'

// The token is valid only in five minutes.
const TOKEN_TTL = 60 * 5 * 1000

export function generateToken(session: AstroSession) {
  const token = makeToken(63)
  const timestamp = (new Date()).getTime()
  session.set('csrf', { token, timestamp })
  return token
}

export async function validateToken(session: AstroSession, token: string): Promise<[boolean, string]> {
  const csrf = await session.get('csrf')
  if (csrf === undefined) {
    return [false, 'No csrf token existed in session']
  }
  session.delete('csrf')
  const now = (new Date()).getTime()
  if (csrf.timestamp + TOKEN_TTL < now) {
    return [false, 'The token is expired']
  }
  if (csrf.token === token) {
    return [true, '']
  }
  return [false, 'csrf token mismatch']
}
