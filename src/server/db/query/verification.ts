import { and, eq, gt, lt, sql } from 'drizzle-orm'
import crypto from 'node:crypto'

import type { NewVerification, Verification } from '@/server/db/types'

import { db } from '@/server/db/pool'
import { verification } from '@/server/db/schema'

export type VerificationPurpose = 'password-reset' | 'author-invite'

const PURPOSE_TTL: Record<VerificationPurpose, number> = {
  'password-reset': 15 * 60, // 15 min
  'author-invite': 7 * 24 * 60 * 60, // 7 days
}

function buildIdentifier(purpose: VerificationPurpose, userId: bigint): string {
  return `${purpose}:${userId}`
}

function parseIdentifier(identifier: string): { purpose: VerificationPurpose; userId: bigint } | null {
  const idx = identifier.indexOf(':')
  if (idx === -1) {
    return null
  }
  const purpose = identifier.slice(0, idx) as VerificationPurpose
  if (!['password-reset', 'author-invite'].includes(purpose)) {
    return null
  }
  const userId = BigInt(identifier.slice(idx + 1))
  if (userId <= 0n) {
    return null
  }
  return { purpose, userId }
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function validateTokenFormat(rawToken: string): boolean {
  return /^[A-Za-z0-9_-]{32,80}$/.test(rawToken)
}

export async function issueVerificationToken(
  userId: bigint,
  purpose: VerificationPurpose,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken()
  const hashed = hashToken(token)
  const identifier = buildIdentifier(purpose, userId)
  const expiresAt = new Date(Date.now() + PURPOSE_TTL[purpose] * 1000)

  // Delete any existing token for the same user+purpose (one active token at a time).
  await db.delete(verification).where(eq(verification.identifier, identifier))

  const row: NewVerification = {
    id: crypto.randomUUID(),
    identifier,
    value: hashed,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await db.insert(verification).values(row)

  return { token, expiresAt }
}

export async function consumeVerificationToken(
  rawToken: string,
  expectedPurpose: VerificationPurpose,
): Promise<{ userId: bigint } | null> {
  if (!validateTokenFormat(rawToken)) {
    return null
  }
  const hashed = hashToken(rawToken)

  // Atomic DELETE ... RETURNING inside a transaction so the token can
  // only be consumed once even under concurrent requests.
  return db.transaction(async (tx) => {
    const rows = await tx
      .delete(verification)
      .where(and(eq(verification.value, hashed), gt(verification.expiresAt, new Date())))
      .returning()

    const row = rows[0] as Verification | undefined
    if (!row) {
      return null
    }

    const parsed = parseIdentifier(row.identifier)
    if (parsed === null || parsed.purpose !== expectedPurpose) {
      return null
    }
    return { userId: parsed.userId }
  })
}

export async function revokeTokensFor(userId: bigint, purpose: VerificationPurpose): Promise<void> {
  const identifier = buildIdentifier(purpose, userId)
  await db.delete(verification).where(eq(verification.identifier, identifier))
}

export async function purgeExpired(): Promise<number> {
  // Keep expired tokens for 1 extra day for audit/debugging before cleanup.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const result = await db
    .delete(verification)
    .where(lt(verification.expiresAt, cutoff))
    .returning({ id: verification.id })
  return result.length
}
