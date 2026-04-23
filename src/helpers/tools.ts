import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'

// Generate a cryptographically-secure URL-safe random string of approximately
// the given length. Uses base64url encoding so the result is safe to use in
// query strings, HTML attributes, and database tokens without escaping.
export function makeToken(length: number): string {
  // base64url emits ~4 chars per 3 bytes; round up so we always meet `length`.
  const bytes = Math.ceil((length * 3) / 4)
  return crypto.randomBytes(bytes).toString('base64url').slice(0, length)
}

export function encodedEmail(email: string): string {
  return crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex')
}

export function isNumeric(str: string): boolean {
  return /^-?\d+$/.test(str)
}

// Constant-time string comparison to avoid leaking secrets through timing.
export function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) {
    return false
  }
  return crypto.timingSafeEqual(aBuf, bBuf)
}
