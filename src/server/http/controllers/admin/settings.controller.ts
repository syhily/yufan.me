import type { ContractImpl } from '@/server/http/ts-rest-adapter'

import { userSession } from '@/server/session'
import { updateSettingsSchema } from '@/server/settings/sections'
import { getAdminBlogSettings } from '@/server/settings/service'
import { updateBlogSettingsSection } from '@/server/settings/service'
import { adminSettingsContract } from '@/shared/contracts/admin/settings'

function safeBigInt(value: string): bigint | null {
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

export const adminSettingsController = {
  getSettings: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const result = await getAdminBlogSettings()
    return { status: 200 as const, body: result }
  },
  updateSettings: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const viewer = ctx.viewer
    const editorId = safeBigInt(viewer.userId)
    await updateBlogSettingsSection(payload.section, payload.payload, editorId)
    return { status: 200 as const, body: { success: true } }
  },
}
