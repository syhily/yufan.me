import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { authContract } from '@/shared/contracts/auth'

import { updateUserById } from '@/server/db/query/user'

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
      return { status: 404, body: { error: { message: '用户不存在' } } }
    }
    return { status: 200, body: { success: true } }
  },
}
