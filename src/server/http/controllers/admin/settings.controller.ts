import type { adminSettingsContract } from '@/shared/contracts/admin/settings'

import { ok } from '@/server/http/response'
import { body, asId, requireViewer, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { getAdminBlogSettings, updateBlogSettingsSection } from '@/server/settings/service'

interface UpdateSettingsBody {
  section: string
  payload: unknown
}

export const adminSettingsController: ContractImpl<typeof adminSettingsContract> = {
  getSettings: async (_args: Record<string, unknown>, _ctx: HandlerContext) => {
    const bundle = await getAdminBlogSettings()
    return ok({ bundle })
  },

  updateSettings: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const b = body<UpdateSettingsBody>(args)
    const editorId = asId(viewer.userId)
    await updateBlogSettingsSection(b.section as Parameters<typeof updateBlogSettingsSection>[0], b.payload, editorId)
    return ok({ success: true })
  },
}
