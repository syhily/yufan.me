import type { ReactNode } from 'react'

import config from '@/blog.config'
import { Footer } from '@/components/partial/Footer'

export interface AdminLayoutBodyProps {
  children?: ReactNode
}

export function AdminLayoutBody({ children }: AdminLayoutBodyProps) {
  const bgImage = `${config.settings.asset.scheme}://${config.settings.asset.host}/images/admin/bg.jpg`
  return (
    <div className="site-layout">
      <div className="desktop-brand">
        <img src="/logo.svg" alt="且听书吟" />
      </div>
      <div className="mobile-brand">
        <div className="container">
          <div className="d-flex flex-flex align-items-center">
            <a href="/" title={config.title} className="d-block">
              <img src="/logo-large.svg" alt="且听书吟" />
            </a>
            <div className="flex-fill" />
          </div>
        </div>
      </div>
      <main className="site-main">
        <div className="row gx-0">
          <div className="col-lg-7 col-xl-7">
            <div className="post p-3 p-md-5">
              <div className="single-full">{children}</div>
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
