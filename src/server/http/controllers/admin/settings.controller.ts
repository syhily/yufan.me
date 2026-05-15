import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'

import { getAdminBlogSettings, updateBlogSettingsSection } from '@/server/settings/service'
import { adminSettingsContract } from '@/shared/contracts/admin/settings'

function safeBigInt(value: string): bigint | null {
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

export const adminSettingsController: AuthedContractImpl<typeof adminSettingsContract> = {
  getSettings: async (_args, _ctx) => {
    const result = await getAdminBlogSettings()
    return { status: 200 as const, body: result }
  },
  updateSettings: async (args, ctx) => {
    const payload = args.body
    const viewer = ctx.viewer!
    const editorId = safeBigInt(viewer.userId)
    await updateBlogSettingsSection(payload.section, payload.payload, editorId)
    return { status: 200 as const, body: { success: true } }
  },
}
