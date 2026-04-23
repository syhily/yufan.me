// Thin facade that re-exports the user repository under the historic helper
// names. New code should import from `@/data/repositories/user` directly; this
// file exists so that components/actions/services already using the helpers
// don't all churn at once. The repository layer owns the actual SQL.

import type { User } from '@/data/db'

import * as userRepo from '@/data/repositories/user'

export const hasAdmin = userRepo.hasAdmin

export async function queryUser(email: string, password: string): Promise<null | User> {
  return userRepo.verifyUserPassword(email, password)
}

export const queryUserId = userRepo.findUserIdByEmail

export const queryEmail = userRepo.findEmailById

export async function createAdmin(name: string, email: string, password: string) {
  return userRepo.insertAdmin(name, email, password)
}

export const createUser = userRepo.insertCommentUser

/**
 * Create a regular user with password (for user registration).
 * Returns null when the email is already registered with a password.
 */
export async function createUserWithPassword(
  name: string,
  email: string,
  password: string,
  website = '',
): Promise<User | null> {
  return userRepo.registerUserWithPassword(name, email, password, website)
}
