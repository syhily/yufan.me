import { redirect } from 'react-router'

// `/wp-admin/settings` is the parent slot of the settings section; the
// `general` page owns the chrome the user sees first. Mirrors the
// `wp-admin.dashboard.tsx` → `wp-admin/comments` redirect pattern.
export function loader() {
  throw redirect('/wp-admin/settings/general')
}

export default function WpAdminSettingsIndex() {
  return null
}
