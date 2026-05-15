import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'

import { updateUserById } from '@/server/db/query/user'
import { authContract } from '@/shared/contracts/auth'

export const authController: AuthedContractImpl<typeof authContract> = {
  updateUser: async ({ params, body }, { viewer }) => {
    if (!viewer) {
      return { status: 401 as const, body: { error: { message: '未登录' } } }
    }
    // Explicit allowlist — never pass arbitrary body fields to the DB layer.
    const updated = await updateUserById(BigInt(params.id), {
      name: body.name,
      email: body.email,
      link: body.link,
      badgeName: body.badgeName,
      badgeColor: body.badgeColor,
      badgeTextColor: body.badgeTextColor,
    })
    if (updated === null) {
      return { status: 404 as const, body: { error: { message: '用户不存在' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
}
