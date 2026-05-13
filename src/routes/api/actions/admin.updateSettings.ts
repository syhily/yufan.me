import { defineApiAction } from '@/server/route-helpers/api-handler'
import { updateSettingsSchema } from '@/server/settings/sections'
import { updateBlogSettingsSection } from '@/server/settings/service'

export const action = defineApiAction({
  method: 'PATCH',
  input: updateSettingsSchema,
  requireRole: 'admin',
  async run({ payload, viewer }) {
    const editorId = safeBigInt(viewer.userId)
    await updateBlogSettingsSection(payload.section, payload.payload, editorId)
    return { success: true as const }
  },
})

function safeBigInt(value: string): bigint | null {
  try {
    return BigInt(value)
  } catch {
    return null
  }
}
