import type { ReactNode } from 'react'

export interface AdminBlockProps {
  admin: boolean
  children: ReactNode
}

export function AdminBlock({ admin, children }: AdminBlockProps) {
  return admin ? <>{children}</> : null
}
