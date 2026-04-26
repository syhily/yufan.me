import { updateUserSchema } from '@/server/auth-schema'
import { updateUserById } from '@/server/db/query/user'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'PATCH',
  input: updateUserSchema,
  requireAdmin: true,
  async run({ payload }) {
    const { userId, ...patch } = payload
    const filtered = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))

    const updated = await updateUserById(BigInt(userId), filtered)
    if (updated === null) {
      throw new ActionFailure(404, '用户不存在')
    }
    return { success: true }
  },
})
