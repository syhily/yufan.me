import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

const here = dirname(fileURLToPath(import.meta.url))
const csrfFile = resolve(here, '../src/server/domains/auth/csrf.ts')
const source = readFileSync(csrfFile, 'utf8')

describe('contract: CSRF cookie configuration', () => {
  it('uses the historical CSRF cookie name (csrf-token)', () => {
    expect(source).toContain("createCookie('csrf-token'")
  })

  it('keeps the cookie httpOnly so client-side JS cannot read it', () => {
    expect(source).toContain('httpOnly: true')
  })

  it('locks SameSite to lax (no third-party CSRF, but normal nav works)', () => {
    expect(source).toContain("sameSite: 'lax'")
  })

  it('scopes the cookie to / (whole site)', () => {
    expect(source).toContain("path: '/'")
  })

  it('derives secure from request protocol (not hard-coded PROD)', () => {
    // After the request-protocol-aware fix, secure is passed via
    // serializeOptions rather than hard-coded in the cookie definition.
    expect(source).toContain('secure: isSecureRequest')
  })

  it('has a TTL of at least 4 hours so long-lived admin sessions do not break', () => {
    // 60 * 60 * 4 = 14400 seconds
    const match = source.match(/CSRF_TOKEN_TTL_SECONDS\s*=\s*([\d\s*+\-/]+)/)
    expect(match).not.toBeNull()
    // Safe evaluation: only digits and * are expected (e.g. 60*60*4)
    const expr = match![1].replace(/\s+/g, '')
    const value = expr
      .split('*')
      .map(Number)
      .reduce((a, b) => a * b, 1)
    expect(value).toBeGreaterThanOrEqual(14400)
  })

  it('uses SESSION_SECRET from env (never a hard-coded literal)', () => {
    expect(source).toContain('secrets: [SESSION_SECRET]')
    // Reject hard-coded string literals like secrets: ['fixed-string']
    expect(source).not.toMatch(/secrets:\s*\[\s*['"]/)
  })
})
