// /api/account/* controller — implements `accountContract`.
//
// Service layer is **untouched**: this controller calls the same
// `findUserById` / `updateUserById` helpers the legacy resource
// route at `routes/api/actions/account.updateProfile.ts` uses, so
// the migration is purely a perimeter swap.

import type { User } from '@/server/db/types/inferred'
import type { ContractImpl } from '@/server/http/ts-rest-adapter'
import type { UserDto } from '@/shared/contracts/_types'

import { findUserById, updateUserById, type UserUpdate } from '@/server/db/query/user'
import { ActionFailure } from '@/server/route-helpers/errors'
import { accountContract } from '@/shared/contracts/account'

function toUserDto(u: User): UserDto {
  return {
    id: u.id.toString(),
    name: u.name,
    email: u.email,
    link: u.link ?? '',
    role: u.role,
    badgeName: u.badgeName ?? '',
    badgeColor: u.badgeColor ?? '',
    badgeTextColor: u.badgeTextColor ?? null,
    // Drizzle types nullable-with-default columns as `T | null`. The
    // column defaults to `true` in the DB so callers never observe
    // null in practice, but the wire DTO is a strict boolean.
    receiveEmail: u.receiveEmail ?? true,
  }
}

export const accountController: ContractImpl<typeof accountContract> = {
  updateProfile: async ({ body }, { viewer }) => {
    // `authedRoute` guarantees `viewer` is set; assert for the type
    // narrowing the ts-rest adapter type cannot carry across middleware.
    if (!viewer) {
      return { status: 401, body: { error: { message: '需要登录后再操作。' } } }
    }

    const userId = BigInt(viewer.userId)
    const dbUser = await findUserById(userId)
    if (!dbUser) {
      return { status: 404, body: { error: { message: '用户不存在。' } } }
    }

    // Visitors cannot set badge fields; authors and admins can.
    // Matches the rule enforced in
    // `routes/api/actions/account.updateProfile.ts`.
    const canSetBadge = viewer.role === 'admin' || viewer.role === 'author'
    const patch: UserUpdate = {}
    if (body.name !== undefined) {
      patch.name = body.name
    }
    if (body.link !== undefined) {
      patch.link = body.link ?? undefined
    }
    if (body.receiveEmail !== undefined) {
      patch.receiveEmail = body.receiveEmail
    }
    if (canSetBadge) {
      if (body.badgeName !== undefined) {
        patch.badgeName = body.badgeName ?? undefined
      }
      if (body.badgeColor !== undefined) {
        patch.badgeColor = body.badgeColor ?? undefined
      }
      if (body.badgeTextColor !== undefined) {
        patch.badgeTextColor = body.badgeTextColor ?? null
      }
    }

    const updated = await updateUserById(userId, patch)
    if (!updated) {
      throw new ActionFailure(500, '保存用户信息失败。')
    }

    return { status: 200, body: { user: toUserDto(updated) } }
  },
}
