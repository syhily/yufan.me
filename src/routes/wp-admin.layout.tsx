import { useEffect } from 'react'
import { data, Outlet, redirect } from 'react-router'

import type { RouteHandle } from '@/root'

import { getRouteRequestContext, issueCsrfToken } from '@/server/session'
import { AdminShell } from '@/ui/admin/shell/AdminShell'

import type { Route } from './+types/wp-admin.layout'
// The wp-admin SPA only needs Tailwind v4 (with the `tw:` prefix) plus the
// shadcn admin theme tokens declared inside `admin-theme.css`. Importing
// `tailwind.css` directly here keeps Bootstrap reboot/grid/utilities and the
// public-site cascade (`globals.css`) out of this route's chunk, matching
// the project's "admin pages do not load globals.css" contract.
import '@/assets/styles/tailwind.css'

export const handle: RouteHandle = { layout: 'admin' }

// React Router v7 keeps already-injected CSS attached to `<head>` across
// SPA navigations on purpose (see `persistentHrefs` in the dev/runtime;
// shared lazy chunks may still reference it). That is the right default
// for layered stylesheets, but it breaks the wp-admin SPA when the user
// navigates here from the public site: `globals.css` (Bootstrap reboot
// + the project's hand-written un-layered `reset.css`) stays in `<head>`,
// and per the W3C cascade-layers spec un-layered rules beat any
// `@layer utilities` rule of any specificity. Concretely: the un-layered
// `button { padding: 0; border: none }` and `img { height: auto }` resets
// erase the shadcn pagination chips, "回复" buttons, header logo, etc.,
// while a hard refresh (which never carries `globals.css` into the
// admin route's chunk graph) renders correctly. This effect closes that
// gap — we detach the public stylesheet on mount and re-attach it on
// unmount so an SPA navigation back to a public page keeps its styling.
function isPublicGlobalsStylesheet(el: Element): boolean {
  if (el.tagName === 'STYLE') {
    // Vite dev server injects `<style data-vite-dev-id="…/globals.css">`
    // for side-effect CSS imports. The id is the absolute file path
    // (optionally followed by `?direct` / query params).
    const devId = el.getAttribute('data-vite-dev-id') ?? ''
    return /[/\\]globals\.css(?:[?#]|$)/.test(devId)
  }
  if (el.tagName === 'LINK') {
    // Production build emits a hashed `<link rel="stylesheet" href="…/assets/globals-XXXX.css">`.
    // Match both unhashed (dev `?url`) and hashed (prod) variants while
    // staying narrow enough to avoid touching unrelated stylesheets.
    const href = (el as HTMLLinkElement).getAttribute('href') ?? ''
    return /(?:\/|^)globals(?:\.|-)[^/]*\.css(?:[?#]|$)/.test(href)
  }
  return false
}

function useDetachPublicGlobalsCss() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    type Detached = { node: Element; nextSibling: Node | null; parent: ParentNode }
    const detached: Detached[] = []
    document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
      if (!isPublicGlobalsStylesheet(el)) return
      const parent = el.parentNode
      if (!parent) return
      detached.push({ node: el, nextSibling: el.nextSibling, parent })
      el.remove()
    })
    return () => {
      // Restore in original document order so a subsequent SPA hop back
      // to a public page paints with the same cascade as a hard refresh.
      for (const { node, nextSibling, parent } of detached) {
        parent.insertBefore(node, nextSibling)
      }
    }
  }, [])
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { admin, user, url } = getRouteRequestContext({ request, context })
  if (!admin) {
    throw redirect(`/wp-login.php?redirect_to=${encodeURIComponent(url.pathname)}`)
  }

  // Reissue a CSRF token at the layout level so every child page (and
  // every modal/form mounted under the SPA shell) shares the same
  // freshly-rotated token without each route having to ask for it again.
  const issued = await issueCsrfToken()
  return data(
    {
      currentUser: {
        id: user?.id ?? '',
        name: user?.name ?? '管理员',
        email: user?.email ?? '',
      },
      csrfToken: issued.token,
    },
    { headers: { 'Set-Cookie': issued.setCookie } },
  )
}

export default function WpAdminLayoutRoute({ loaderData }: Route.ComponentProps) {
  useDetachPublicGlobalsCss()
  return (
    <AdminShell currentUser={loaderData.currentUser}>
      <Outlet context={{ csrfToken: loaderData.csrfToken, currentUser: loaderData.currentUser }} />
    </AdminShell>
  )
}
