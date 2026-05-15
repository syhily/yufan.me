import { z } from 'zod'

import type { SettingsSection } from '@/shared/settings'

import { adminProc } from '@/server/http/orpc-base'
import { getAdminBlogSettings, updateBlogSettingsSection } from '@/server/settings/service'
import { blogSettingsBundleDto } from '@/shared/contracts/_dtos'

function safeBigInt(value: string): bigint | null {
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

const get = adminProc
  .output(z.object({ bundle: blogSettingsBundleDto.nullable() }))
  .handler(() => getAdminBlogSettings())

const update = adminProc
  .input(z.object({ section: z.string(), payload: z.unknown() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const editorId = safeBigInt(context.viewer.userId)
    await updateBlogSettingsSection(input.section as SettingsSection, input.payload, editorId)
    return { success: true }
  })

export const adminSettingsRouter = { get, update }
