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

// Hash an email address into the canonical Gravatar identifier.
//
// Gravatar accepts SHA-256 since 2024 and explicitly recommends moving off
// MD5 ("Don't use MD5!" — docs.gravatar.com/rest/api-data-specifications/),
// since MD5 is brute-forceable on the limited keyspace of real-world e-mail
// addresses, which can leak the original address.
export function encodedEmail(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
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

// Fisher-Yates shuffle. Returns a new array; does not mutate the input.
// Uses Math.random because callers (sidebars, friends list) only need
// rendering variety, not unpredictability.
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = items.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Lodash's `_.sampleSize`: pick `n` distinct items from `items`, in random
// order. Drop-in replacement so we no longer need to ship lodash on the
// server (~70KB of duplicated functionality for two utilities).
export function sampleSize<T>(items: readonly T[], n: number): T[] {
  if (n <= 0 || items.length === 0) return []
  if (n >= items.length) return shuffle(items)
  return shuffle(items).slice(0, n)
}

// Group an array by the result of a key function. Replaces _.groupBy for the
// (currently single) call site that needed it.
export function groupBy<T, K extends string | number>(items: readonly T[], keyFn: (item: T) => K): Record<K, T[]> {
  const result = {} as Record<K, T[]>
  for (const item of items) {
    const key = keyFn(item)
    ;(result[key] ??= []).push(item)
  }
  return result
}
