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
    // The value may be a literal number or an expression like 60 * 60 * 4
    expect(source).toMatch(/CSRF_TOKEN_TTL_SECONDS\s*=/)
    const match = source.match(/CSRF_TOKEN_TTL_SECONDS\s*=\s*(.+)/)
    expect(match).not.toBeNull()
    const raw = match![1].trim()
    // Evaluate the expression safely; if it's already a number this still works
    const value =
      /\d+/.test(raw) && !/[a-zA-Z_]/.test(raw) ? (new Function(`return (${raw})`)() as number) : Number(raw)
    expect(value).toBeGreaterThanOrEqual(14400)
  })

  it('uses SESSION_SECRET from env (never a hard-coded literal)', () => {
    expect(source).toContain('secrets: [SESSION_SECRET]')
    // Reject hard-coded string literals like secrets: ['fixed-string']
    expect(source).not.toMatch(/secrets:\s*\[\s*['"]/)
  })
})
