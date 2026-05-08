import { defineApiAction } from '@/server/route-helpers/api-handler'
import { userSession } from '@/server/session'
import { updateSettingsSchema } from '@/server/settings/sections'
import { updateBlogSettingsSection } from '@/server/settings/service'

export const action = defineApiAction({
  method: 'PATCH',
  input: updateSettingsSchema,
  requireAdmin: true,
  async run({ ctx, payload }) {
    const editor = userSession(ctx.session)
    const editorId = editor?.id ? safeBigInt(editor.id) : null
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
