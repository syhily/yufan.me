import { defineApiAction } from '@/server/route-helpers/api-handler'
import { userSession } from '@/server/session'
import { resetSettingsSchema } from '@/server/settings/schema'
import { resetBlogSettingsSection } from '@/server/settings/service'

export const action = defineApiAction({
  method: 'POST',
  input: resetSettingsSchema,
  requireAdmin: true,
  async run({ ctx, payload }) {
    const editor = userSession(ctx.session)
    const editorId = editor?.id ? safeBigInt(editor.id) : null
    const settings = await resetBlogSettingsSection(payload.section, editorId)
    return { settings }
  },
})

function safeBigInt(value: string): bigint | null {
  try {
    return BigInt(value)
  } catch {
    return null
  }
}
