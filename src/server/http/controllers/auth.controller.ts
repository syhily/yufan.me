import { updateUserById } from '@/server/db/query/user'

export const authController = {
  updateUser: async (
    { params, body }: { params: { id: string }; body: Record<string, unknown> },
    { viewer }: { viewer: { userId: string; role: string } | null },
  ) => {
    if (!viewer) {
      return { status: 401 as const, body: { error: { message: '未登录' } } }
    }
    const filtered = Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined))
    const updated = await updateUserById(BigInt(params.id), filtered)
    if (updated === null) {
      return { status: 404 as const, body: { error: { message: '用户不存在' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
}
