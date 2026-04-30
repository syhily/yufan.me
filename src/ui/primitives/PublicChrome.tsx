import type { ReactNode } from 'react'

import type { BlogConfig } from '@/shared/blog-config'

import { BaseLayout } from '@/ui/primitives/BaseLayout'
// `globals.css` is the public site's complete cascade (Bootstrap reboot/grid/
// utilities, hand-written `_base.css`/`_widgets.css`/`_comments.css`, and
// Tailwind v4 with the `tw:` prefix). It lives on this wrapper — and ONLY
// on this wrapper — so two contracts hold simultaneously:
//
//   1. The public site reaches `PublicChrome` through a static import from
//      `routes/public.layout.tsx`. React Router can therefore include the
//      compiled `globals.css` chunk in `<Links />` during SSR, eliminating
//      the FOUC that occurs when stylesheets ride a `React.lazy()` chunk.
//
//   2. The wp-admin SPA never touches this file (its layout imports
//      `tailwind.css` directly), so the admin chunk stays Bootstrap-free.
//      The legacy `wp-login` / install split-screen still imports
//      `globals.css` itself in `routes/admin.layout.tsx` because that
//      view is built on Bootstrap grid/utility classes.
//
// IMPORTANT: do not re-export `PublicChrome` (or any binding from this
// module) from `@/root` or `@/ui/primitives/BaseLayout`. A re-export
// statically pins the module — the live binding must be observable —
// which would drag `globals.css` into the wp-admin chunk and break the
// cascade contract documented in `tailwind.css` (the un-layered
// `button { padding: 0; border: none }` rule from `reset.css` would
// then beat the layered `tw:px-5` / `tw:border` utilities, stripping
// all padding from shadcn buttons; see #admin-buttons-no-padding).
import '@/assets/styles/globals.css'

export interface PublicChromeProps {
  navigation?: BlogConfig['navigation']
  footer?: boolean
  admin: boolean
  children?: ReactNode
}

// Thin wrapper that owns the public-site stylesheet cascade and renders the
// shared `<BaseLayout>` chrome. Public routes mount this through
// `routes/public.layout.tsx`; the root `ErrorBoundary` lazy-loads it so the
// admin SPA chunk never statically depends on `globals.css`.
export function PublicChrome({ navigation, footer, admin, children }: PublicChromeProps) {
  return (
    <BaseLayout navigation={navigation} footer={footer} admin={admin}>
      {children}
    </BaseLayout>
  )
}
