import type { ComponentPropsWithRef, ElementType, ReactNode } from 'react'

import { cn } from '@/ui/lib/cn'

// Absolute "cover layer" used inside `<Media ratio=...>` cards.
//
// Replaces every per-file copy of `MEDIA_CONTENT_CLASS` (PostListViews has
// the `group` variant, CategoriesBody / Friends / etc. have the plain
// variant) with one primitive. Children that need hover-driven overlays
// can rely on the wrapper's `group` class via `group-hover:*`.
//
// `as` lets the cover act as the click target itself — typically `<Link
// to=...>` for an internal route or `<a href=...>` for an external link —
// without a wrapping element. We use `as` instead of `asChild` because the
// cover is the leaf element here; render-prop nesting would buy nothing
// and slot composition (`asChild`) belongs to widgets that own children.
const COVER_BASE =
  'absolute inset-0 border-0 rounded-[inherit] bg-cover bg-no-repeat bg-center [&>img]:w-full [&>img]:h-full [&>img]:object-cover [&>img]:block'

export interface MediaCoverProps<T extends ElementType = 'div'> {
  /**
   * Renderable element type. Defaults to `<div>`. Use `Link` from
   * `react-router` for internal routes or `'a'` for external links.
   */
  as?: T
  /**
   * Adds Tailwind's `group` class so children can use `group-hover:*` /
   * `group-focus:*` overlay utilities. Defaults to `false`; turn it on
   * for cover layers that participate in hover/focus transitions
   * (listing cards, hero teasers).
   */
  hover?: boolean
  className?: string
  children?: ReactNode
}

type MediaCoverComponentProps<T extends ElementType> = MediaCoverProps<T> &
  Omit<ComponentPropsWithRef<T>, keyof MediaCoverProps<T>>

export function MediaCover<T extends ElementType = 'div'>({
  as,
  hover = false,
  className,
  children,
  ...props
}: MediaCoverComponentProps<T>) {
  const Tag = (as ?? 'div') as ElementType
  return (
    <Tag className={cn(COVER_BASE, hover && 'group', className)} {...props}>
      {children}
    </Tag>
  )
}
