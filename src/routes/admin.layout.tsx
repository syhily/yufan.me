import { Link, Outlet } from 'react-router'

import type { RouteHandle } from '@/root'

import config from '@/blog.config'
import '@/assets/styles/admin.css'
import { Footer } from '@/ui/primitives/Footer'

// Tells `root.tsx` to skip rendering `<BaseLayout>` for any descendant route,
// so the admin / login stack can own its own chrome.
export const handle: RouteHandle = { layout: 'admin' }

export default function AdminLayoutRoute() {
  const bgImage = `${config.settings.asset.scheme}://${config.settings.asset.host}/images/admin/bg.jpg`
  return (
    <div className="site-layout">
      <div className="desktop-brand">
        <img src="/logo.svg" alt="且听书吟" />
      </div>
      <div className="mobile-brand">
        <div className="container">
          <div className="d-flex flex-flex align-items-center">
            <Link to="/" title={config.title} className="d-block" prefetch="intent">
              <img src="/logo-large.svg" alt="且听书吟" />
            </Link>
            <div className="flex-fill" />
          </div>
        </div>
      </div>
      <main className="site-main">
        <div className="row gx-0">
          <div className="col-lg-7 col-xl-7">
            <div className="post p-3 p-md-5">
              <div className="single-full">
                <Outlet />
              </div>
            </div>
            <Footer />
          </div>
          <div className="col-lg-5 col-xl-5 d-none d-lg-block sticky-top hv">
            <div className="bg-img hv" style={{ backgroundImage: `url('${bgImage}')` }} />
          </div>
        </div>
      </main>
    </div>
  )
}
