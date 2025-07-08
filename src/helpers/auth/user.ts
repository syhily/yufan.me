import type { NewUser } from '../db/types'
import bcrypt from 'bcryptjs'
import { db } from '@/helpers/db/pool'
import { user } from '@/helpers/db/schema'
import options from '@/options'

export async function createAdmin(name: string, email: string, password: string) {
  const hashedPassword = bcrypt.hashSync(password, 10)
  const admin: NewUser = {
    name,
    email,
    emailVerified: false,
    link: options.website,
    isAdmin: true,
    password: hashedPassword,
    badgeName: 'MOD',
    badgeColor: '#008c95',
    receiveEmail: true,
  }
  return await db.insert(user).values(admin).returning()
}
