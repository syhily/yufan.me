import { Link, Outlet } from 'react-router'

import type { RouteHandle } from '@/root'

import config from '@/blog.config'
import { Container } from '@/ui/primitives/Container'
import { Footer } from '@/ui/primitives/Footer'

// Tells `root.tsx` to skip rendering `<BaseLayout>` for any descendant route,
// so the admin / login stack can own its own chrome.
export const handle: RouteHandle = { layout: 'admin' }

export default function AdminLayoutRoute() {
  const bgImage = `${config.settings.asset.scheme}://${config.settings.asset.host}/images/admin/bg.jpg`
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-surface-muted">
      <div className="absolute left-10 top-10 max-lg:hidden [&_img]:h-[100px]">
        <img src="/logo.svg" alt="且听书吟" />
      </div>
      <div>
        <Container>
          <div className="flex items-center">
            <Link to="/" title={config.title} className="block" prefetch="intent">
              <img src="/logo-large.svg" alt="且听书吟" />
            </Link>
            <div className="flex-1" />
          </div>
        </Container>
      </div>
      <main className="flex flex-1 flex-col">
        <div className="grid grid-cols-1 gap-x-0 lg:grid-cols-[7fr_5fr]">
          <div className="min-w-0">
            <div className="p-3 md:p-5">
              <div className="flex items-center justify-center text-center h-[70vh]">
                <Outlet />
              </div>
            </div>
            <Footer />
          </div>
          <div className="hidden min-w-0 lg:block sticky top-0 z-10 h-screen">
            <div className="bg-img h-screen" style={{ backgroundImage: `url('${bgImage}')` }} />
          </div>
        </div>
      </main>
    </div>
  )
}
