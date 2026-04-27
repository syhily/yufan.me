import type { ReactNode } from 'react'
import type { LinkProps } from 'react-router'

import { Link } from 'react-router'

// Unified link primitive that picks between React Router's `<Link>` (for
// in-app SPA navigation with prefetch hints) and a plain `<a>` (for
// `https?://` URLs and explicit `target="_blank"` opt-ins). Replaces the
// open-coded `isExternalNavTarget()` branch in `Header.tsx`, the
// `safeHref` + `<a target="_blank" rel="nofollow noreferrer">` chain in
// `Sidebar.tsx`'s `CommentLink`, and the `target="_blank"` ICP / social
// links in `Footer.tsx`.
//
// The component intentionally does NOT cover:
//   - in-page anchors (`#hash`) — pass `external` to suppress prefetch
//     when needed, but the rare in-page case can keep using
//     `<Link to="#…" prefetch="none">` directly.
//   - `mailto:` / `tel:` — these are external by URL, so the heuristic
//     correctly delegates to the `<a>` branch.
export type NavLinkPrefetch = LinkProps['prefetch']

export interface NavLinkProps {
  /** Link target — internal `/foo` or external `https://…`. */
  href: string
  /**
   * Force the external `<a>` branch even for relative-style URLs. Useful
   * when a CMS-driven nav entry sets `target="_blank"` on a same-site
   * page (e.g. `/print/`).
   */
  external?: boolean
  /**
   * `<Link>` prefetch policy when rendering the internal branch. No-op
   * for external links. Defaults to `'intent'`, which matches the
   * project-wide budget for above-the-fold nav.
   */
  prefetch?: NavLinkPrefetch
  /**
   * `target` attribute for the external `<a>`. Required when callers
   * want a same-tab external link (e.g. `target="_self"`); defaults to
   * `'_blank'` because every external link on the site (header
   * navigation, footer ICP, sidebar author links) opens in a new tab.
   */
  target?: '_blank' | '_self'
  /**
   * `rel` attribute for the external `<a>`. Defaults to
   * `'nofollow noreferrer'` — the project-wide policy for outbound
   * links so search engines don't conflate friend-site link weight
   * with ours and the destination can't sniff the originating URL.
   */
  rel?: string
  className?: string
  title?: string
  /** Forwarded as `aria-label` on the rendered element. */
  ariaLabel?: string
  /** Caller-provided id (used by Header for `menu-item-N`). */
  id?: string
  onClick?: () => void
  children: ReactNode
}

const EXTERNAL_RE = /^https?:\/\//i

export function NavLink({
  href,
  external,
  prefetch = 'intent',
  target = '_blank',
  rel = 'nofollow noreferrer',
  className,
  title,
  ariaLabel,
  id,
  onClick,
  children,
}: NavLinkProps) {
  const isExternal = external ?? EXTERNAL_RE.test(href)

  if (isExternal) {
    return (
      <a
        id={id}
        href={href}
        target={target}
        rel={rel}
        className={className}
        title={title}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {children}
      </a>
    )
  }

  return (
    <Link
      id={id}
      to={href}
      prefetch={prefetch}
      className={className}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </Link>
  )
}
