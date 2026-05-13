import { eq, lt, sql } from 'drizzle-orm'
import { createHash, randomBytes } from 'node:crypto'

import { db } from '@/server/db/pool'
import { verification } from '@/server/db/schema'
import { getLogger } from '@/server/logger'

const log = getLogger('verification-tokens')

const TOKEN_BYTES = 32
const RESET_TTL_MS = 15 * 60 * 1000
const SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1000

function sha256(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

function tokenId(purpose: string, userId: number): string {
  return `${purpose}:${userId}`
}

export interface TokenResult {
  token: string
  expiresAt: Date
}

export async function issueResetToken(userId: number): Promise<TokenResult> {
  return issueToken(userId, 'password-reset', RESET_TTL_MS)
}

export async function issueSetupToken(userId: number): Promise<TokenResult> {
  return issueToken(userId, 'author-invite', SETUP_TTL_MS)
}

async function issueToken(userId: number, purpose: string, ttlMs: number): Promise<TokenResult> {
  const identifier = tokenId(purpose, userId)
  const raw = generateToken()
  const value = sha256(raw)
  const expiresAt = new Date(Date.now() + ttlMs)
  const id = generateToken().slice(0, 24)

  await db.transaction(async (tx) => {
    await tx.delete(verification).where(eq(verification.identifier, identifier))
    await tx.insert(verification).values({ id, identifier, value, expiresAt })
  })

  return { token: raw, expiresAt }
}

function validatedTokenRow(row: { identifier: string; expiresAt: Date } | undefined, purpose: string) {
  if (!row) {
    return null
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return null
  }
  const [rowPurpose, userIdStr] = row.identifier.split(':')
  if (rowPurpose !== purpose) {
    return null
  }
  const userId = Number.parseInt(userIdStr, 10)
  if (!Number.isFinite(userId)) {
    return null
  }
  return { userId }
}

/**
 * Read-only check that the token exists, has the expected purpose, and
 * is unexpired. Does NOT delete the row — callers in the loader use
 * this to short-circuit a form before the user submits a password.
 * The destructive {@link consumeToken} is reserved for the action.
 */
export async function peekToken(rawToken: string, purpose: string): Promise<{ userId: number } | null> {
  if (!/^[A-Za-z0-9_-]{32,80}$/.test(rawToken)) {
    return null
  }
  const value = sha256(rawToken)
  try {
    const rows = await db
      .select({ identifier: verification.identifier, expiresAt: verification.expiresAt })
      .from(verification)
      .where(eq(verification.value, value))
      .limit(1)
    return validatedTokenRow(rows[0], purpose)
  } catch (error) {
    log.error('peekToken failed', { error })
    return null
  }
}

/**
 * Delete the row matching `rawToken` and return `{ userId }` if the row
 * exists, has the expected purpose, and is unexpired. Single-shot — a
 * subsequent call with the same token returns `null`.
 */
export async function consumeToken(rawToken: string, purpose: string): Promise<{ userId: number } | null> {
  if (!/^[A-Za-z0-9_-]{32,80}$/.test(rawToken)) {
    return null
  }
  const value = sha256(rawToken)
  try {
    const rows = await db
      .delete(verification)
      .where(eq(verification.value, value))
      .returning({ identifier: verification.identifier, expiresAt: verification.expiresAt })
    return validatedTokenRow(rows[0], purpose)
  } catch (error) {
    log.error('consumeToken failed', { error })
    return null
  }
}

export async function revokeTokensFor(userId: number, purpose: string): Promise<void> {
  await db.delete(verification).where(eq(verification.identifier, tokenId(purpose, userId)))
}

export async function purgeExpired(): Promise<number> {
  const result = await db.delete(verification).where(lt(verification.expiresAt, sql`now() - interval '1 day'`))
  return result.rowCount ?? 0
}
