import { redirect } from 'react-router'

// `/wp-admin` is reserved as the SPA's entry. Redirecting to the
// comments page keeps the URL stable for direct navigation while
// letting that page own all of the dashboard chrome the user sees.
export function loader() {
  throw redirect('/wp-admin/comments')
}

export default function WpAdminDashboard() {
  return null
}
