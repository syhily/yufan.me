import type { ReactNode } from 'react'

import { cn } from '@/ui/lib/cn'

interface GhostSettingSectionProps {
  /** Section title — rendered as a prominent heading above all groups. */
  title: string
  /** Optional description shown beneath the title. */
  description?: string
  /** Section id — used as the scroll-to anchor target. */
  id?: string
  children: ReactNode
  className?: string
}

// A logical grouping of one or more `GhostSettingGroup`s.
// Renders a large heading + optional description, then the children.
// The `id` prop enables smooth-scroll anchor navigation from the sidebar.
export function GhostSettingSection({ title, description, id, children, className }: GhostSettingSectionProps) {
  return (
    <section id={id} className={cn('scroll-mt-8', className)}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  )
}
