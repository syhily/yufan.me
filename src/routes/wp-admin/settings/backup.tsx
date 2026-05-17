import type { LoaderFunctionArgs } from 'react-router'

import { useLoaderData, useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin/settings/layout'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'
import { checkPgToolsAvailable, listBackups } from '@/server/domains/backup/service'
import { settingsMeta } from '@/server/render/seo/settings-meta'
import { requireBlogSettingsSection } from '@/shared/config/blog'
import { BackupView } from '@/ui/admin/settings/BackupView'

export const meta = settingsMeta('备份与还原')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  const assets = requireBlogSettingsSection('assets')
  const s3Enabled = assets.storage.enabled
  const pgToolsAvailable = await checkPgToolsAvailable()
  const backups = s3Enabled && pgToolsAvailable ? await listBackups() : []
  return { s3Enabled, pgToolsAvailable, backups }
}

export default function WpAdminSettingsBackupRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  const loaderData = useLoaderData<typeof loader>()
  return (
    <BackupView
      backup={
        bundle.backup ?? {
          scheduled: { enabled: false, frequency: 'daily', hour: 3, minute: 0 },
          retention: { enabled: true, days: 30 },
        }
      }
      timeZone={bundle.siteIdentity.timeZone}
      s3Enabled={loaderData.s3Enabled}
      pgToolsAvailable={loaderData.pgToolsAvailable}
      initialBackups={loaderData.backups}
    />
  )
}
