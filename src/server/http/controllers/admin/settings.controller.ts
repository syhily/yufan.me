import { z } from 'zod'

import { adminProc } from '@/server/http/orpc-base'
import { getAdminBlogSettings, updateBlogSettingsSection } from '@/server/settings/service'
import { SETTINGS_SECTIONS, type SettingsSection } from '@/shared/config/settings'
import { blogSettingsBundleDto } from '@/shared/contracts/settings'

function safeBigInt(value: string): bigint | null {
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

const get = adminProc
  .route({ method: 'GET', path: '/admin/settings/get' })
  .output(z.object({ bundle: blogSettingsBundleDto.nullable() }))
  .handler(() => getAdminBlogSettings())

const update = adminProc
  .route({ method: 'POST', path: '/admin/settings/update' })
  .input(
    z.object({
      section: z.enum([...SETTINGS_SECTIONS] as [SettingsSection, ...SettingsSection[]]),
      payload: z.record(z.string(), z.unknown()),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const editorId = safeBigInt(context.viewer.userId)
    await updateBlogSettingsSection(input.section, input.payload, editorId)
    return { success: true }
  })

export const adminSettingsRouter = { get, update }
