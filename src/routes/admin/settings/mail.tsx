import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'
import { hydrateBlogSettings } from '@/server/domains/settings/snapshot'
import { bundleFromMatches, routeMeta } from '@/server/render/seo/meta'
import { MailForm } from '@/ui/admin/settings/MailForm'

import type { Route } from './+types/mail'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '邮件服务' }, bundleFromMatches(matches))
}

// `mail` lives outside `BlogConfigSnapshot` (it carries an API key, so
// we keep it off the shared client-safe surface). The parent layout
// loader can't expose it through the outlet context for the same
// reason. This loader reads the live snapshot directly and projects
// only the fields the editor needs — the API key is masked
// before it leaves the server, so the raw value never reaches the
// browser.
export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  const bundle = await hydrateBlogSettings()
  if (bundle === null) {
    // `installGateMiddleware` redirects pre-install requests, so by the
    // time the admin shell renders this route the snapshot is hydrated.
    // Surface the unexpected case as 503 instead of dereferencing
    // `bundle.mail`.
    throw new Response('Blog has not been installed yet.', { status: 503 })
  }
  const mail = bundle.mail?.mail ?? { enabled: false, host: '', sender: '', apiKey: '' }
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
  // The mail form intentionally does not consume any settings outlet
  // context — its data lives on the route's own loader so the API key
  // mask never reaches the public bundle. We still need React Router
  // to mount the form inside the settings shell, so the route is
  // declared as a child of `admin.settings.layout` even though we
  // don't read from `useOutletContext` here.
  return <MailForm mail={loaderData.mail} />
}
