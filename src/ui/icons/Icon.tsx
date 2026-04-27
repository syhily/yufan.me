// Inline SVG icon primitives.
//
// Each icon under `@/ui/icons/icons` is a real React component that renders
// `<Svg name="…"><path d="…" /></Svg>`, so the path data ships as plain JSX
// — no `?raw` imports, no runtime parsing, no `dangerouslySetInnerHTML`. The
// envelope (size, className, fill, role/aria, optional <title>) is owned by
// the shared `<Svg>` component below.
//
// Call sites import the icon they need by name
// (`import { MenuIcon } from '@/ui/icons/icons'`) so Rolldown can prune the
// rest from the client bundle (`bundle-analyzable-paths`, plus the shadcn
// "Pass icons as objects, not string keys" rule). The `<DynamicIcon>` shim
// in `@/ui/icons/icons` covers the small number of call sites that select an
// icon from runtime configuration (social links, share buttons, QR dialogs).

import type { ReactNode } from 'react'

export interface IconProps {
  /** CSS sizing hint applied to the rendered SVG. Defaults to `1em`. */
  size?: string | number
  /** Accessible title; if provided the icon becomes `role="img"`. */
  title?: string
  className?: string
}

export interface SvgProps extends IconProps {
  /** Stable icon name; used to compose the `icon-<name>` className. */
  name: string
  /** SVG path data and other inner elements. */
  children: ReactNode
}

// Shared SVG envelope used by every named icon component. The attribute
// order (`viewBox` → `width`/`height` → `class` → `fill` → focus/aria) is
// fixed to match the previous string-templated renderer so existing CSS
// selectors (`.icon`, `.icon-<name>`) and snapshot expectations keep
// matching.
export function Svg({ name, size, title, className, children }: SvgProps) {
  const dim = size ?? '1em'
  const classList = ['icon', `icon-${name}`, className].filter(Boolean).join(' ')

  return (
    <svg
      viewBox="0 0 1024 1024"
      width={dim}
      height={dim}
      className={classList}
      fill="currentColor"
      focusable="false"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

// Hand-curated union of every icon currently shipped under `@/ui/icons`.
// Used by `blog.config.ts` and the `<DynamicIcon>` shim for call sites that
// genuinely select an icon from runtime config (e.g. social link icons).
// The 1:1 map between this union and the named exports of
// `@/ui/icons/icons` is asserted at the bottom of `icons.tsx`.
export type IconName =
  | 'arrowup'
  | 'check'
  | 'close'
  | 'comment'
  | 'delete'
  | 'edit'
  | 'ellipsis'
  | 'eye'
  | 'github'
  | 'heart'
  | 'left'
  | 'link'
  | 'menu'
  | 'qq'
  | 'refresh'
  | 'reply'
  | 'right'
  | 'search'
  | 'twitter'
  | 'user'
  | 'wechat'
  | 'weibo'
