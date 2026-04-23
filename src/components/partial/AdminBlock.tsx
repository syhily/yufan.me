import type { AstroSession } from 'astro'
import type { ReactNode } from 'react'

import { isAdmin } from '@/services/auth/session'

export interface AdminBlockProps {
  session: AstroSession | undefined
  children: ReactNode
}

// Async server component — renders children only for logged-in admins.
// Called once per render; per-node admin checks (e.g. inside recursive
// comment trees) should hoist the boolean to the caller and pass a plain
// `admin` flag down instead of calling `isAdmin` on every recursion.
export async function AdminBlock({ session, children }: AdminBlockProps) {
  const admin = await isAdmin(session)
  return admin ? <>{children}</> : null
}
