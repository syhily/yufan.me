import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { findUserById, updateUserPasswordById } from '@/server/db/query/user'
import {
  consumeVerificationToken,
  issueVerificationToken,
  purgeExpired,
  revokeTokensFor,
  type VerificationPurpose,
} from '@/server/db/query/verification'
import { getLogger } from '@/server/logger'

const log = getLogger('auth.verification-tokens')

export async function issueResetToken(userId: bigint): Promise<{ token: string; expiresAt: Date }> {
  return issueVerificationToken(userId, 'password-reset')
}

export async function issueSetupToken(userId: bigint): Promise<{ token: string; expiresAt: Date }> {
  return issueVerificationToken(userId, 'author-invite')
}

export async function consumeToken(rawToken: string, purpose: VerificationPurpose): Promise<{ userId: bigint } | null> {
  return consumeVerificationToken(rawToken, purpose)
}

export async function revokeTokens(userId: bigint, purpose: VerificationPurpose): Promise<void> {
  await revokeTokensFor(userId, purpose)
}

export async function consumeResetAndSetPassword(
  rawToken: string,
  newPassword: string,
): Promise<{ ok: true; userId: bigint } | { ok: false; reason: 'invalid' | 'user_missing' }> {
  const result = await consumeVerificationToken(rawToken, 'password-reset')
  if (result === null) {
    return { ok: false, reason: 'invalid' }
  }
  const user = await findUserById(result.userId)
  if (user === null) {
    return { ok: false, reason: 'user_missing' }
  }
  await updateUserPasswordById(result.userId, newPassword)
  await revokeAllSessionsOfUser(result.userId)
  log.info('password reset consumed', { userId: result.userId.toString() })
  return { ok: true, userId: result.userId }
}

export async function consumeSetupAndSetPassword(
  rawToken: string,
  newPassword: string,
): Promise<{ ok: true; userId: bigint } | { ok: false; reason: 'invalid' | 'user_missing' | 'already_set' }> {
  const result = await consumeVerificationToken(rawToken, 'author-invite')
  if (result === null) {
    return { ok: false, reason: 'invalid' }
  }
  const user = await findUserById(result.userId)
  if (user === null) {
    return { ok: false, reason: 'user_missing' }
  }
  if (user.password !== '' && user.password !== null) {
    return { ok: false, reason: 'already_set' }
  }
  await updateUserPasswordById(result.userId, newPassword)
  await revokeAllSessionsOfUser(result.userId)
  log.info('author invite accepted', { userId: result.userId.toString() })
  return { ok: true, userId: result.userId }
}

export async function runPurgeExpired(): Promise<number> {
  return purgeExpired()
}
