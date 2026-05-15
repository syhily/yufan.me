import type { adminSettingsContract } from '@/shared/contracts/admin/settings'

import { ok } from '@/server/http/response'
import { requireViewer, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { getAdminBlogSettings, updateBlogSettingsSection } from '@/server/settings/service'

function safeBigInt(value: string): bigint | null {
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

export const adminSettingsController: ContractImpl<typeof adminSettingsContract> = {
  getSettings: async (_args: Record<string, unknown>, _ctx: HandlerContext) => {
    const bundle = await getAdminBlogSettings()
    return ok({ bundle })
  },

  updateSettings: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const body = args.body as { section: string; payload: unknown }
    const editorId = safeBigInt(viewer.userId)
    await updateBlogSettingsSection(
      body.section as Parameters<typeof updateBlogSettingsSection>[0],
      body.payload,
      editorId,
    )
    return ok({ success: true })
  },
}
