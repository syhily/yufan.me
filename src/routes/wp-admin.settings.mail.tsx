import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { routeMeta } from '@/server/seo/meta'
import { hydrateBlogSettings } from '@/server/settings/snapshot'
import { MailForm } from '@/ui/admin/settings/MailForm'

import type { Route } from './+types/wp-admin.settings.mail'

export function meta() {
  return routeMeta({ title: '邮件服务' })
}

// `mail` lives outside `BlogConfigSnapshot` (it carries an API key, so
// we keep it off the shared client-safe surface). The parent layout
// loader can't expose it through the outlet context for the same
// reason. This loader reads the live snapshot directly and projects
// only the fields the editor needs — the API key is masked
// before it leaves the server, so the raw value never reaches the
// browser.
export async function loader(_args: Route.LoaderArgs) {
  const settings = await hydrateBlogSettings()
  const mail = settings.settings.mail
  return {
    mail: {
      enabled: mail.enabled,
      host: mail.host,
      sender: mail.sender,
      // Show only the last 4 characters of the API key so the editor
      // can confirm "the key is set" without ever round-tripping the
      // secret to the browser. An empty key reports as `null` so the UI
      // can tell "unset" from "set but masked".
      apiKeyMask: mail.apiKey === '' ? null : mail.apiKey.slice(-4),
    },
  }
}

export default function WpAdminSettingsMailRoute({ loaderData }: Route.ComponentProps) {
  const { csrfToken } = useOutletContext<SettingsOutletContext>()
  return <MailForm mail={loaderData.mail} csrfToken={csrfToken} />
}
