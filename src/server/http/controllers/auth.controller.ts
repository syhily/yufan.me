import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { authContract } from '@/shared/contracts/auth'

import { updateUserById } from '@/server/db/query/user'
import { ok, notFound } from '@/server/http/response'

export const authController: ContractImpl<typeof authContract> = {
  updateUser: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const body = args.body as {
      userId: string
      name?: string
      email?: string
      link?: unknown
      badgeName?: string
      badgeColor?: string
      badgeTextColor?: unknown
    }
    const { userId, ...patch } = body
    const filtered = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))

    const updated = await updateUserById(BigInt(userId), filtered)
    if (updated === null) {
      return notFound('用户不存在')
    }
    return ok({ success: true })
  },
}
