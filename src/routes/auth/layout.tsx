import { Outlet } from 'react-router'

import type { RouteHandle } from '@/root'

import { useDetachPublicCss } from '@/client/hooks/use-detach-public-css'
import { AdminErrorFallback } from '@/ui/admin/shell/AdminErrorFallback'
// The login / install screen is admin chrome — same shadcn / Tailwind v4
// cascade the admin SPA uses, so import `tailwind.css` directly. This
// keeps the public-site Bootstrap cascade (`public.css`) and the
// historical `admin.css` Bootstrap split-screen rules out of this route's
// chunk, matching the project's "admin pages do not load public.css"
// contract.
import '@/assets/styles/admin.css'

// Tells `root.tsx` to skip rendering `<BaseLayout>` for any descendant route
// so the admin / login stack can own its own chrome.
export const handle: RouteHandle = { layout: 'admin' }

export { AdminErrorFallback as ErrorBoundary }

export default function AdminLayoutRoute() {
  useDetachPublicCss()

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,var(--accent),transparent_55%),radial-gradient(circle_at_bottom_right,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_60%)]"
      />
      <main className="w-full max-w-[500px] px-8 py-12">
        <Outlet />
      </main>
    </div>
  )
}
