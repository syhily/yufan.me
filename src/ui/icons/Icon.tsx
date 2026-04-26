// Inline SVG icon renderer for React server components.
//
// Each icon under `src/ui/icons/svg/*.svg` is exported as a *named* component
// from `@/ui/icons/icons` (e.g. `MenuIcon`, `SearchIcon`). Call sites use
// static named imports so Rolldown can statically analyse which icons are
// actually shipped (`bundle-analyzable-paths`, plus the shadcn "Pass icons as
// objects, not string keys" rule).
//
// This file used to expose a string-keyed `<Icon name="…" />` lookup backed by
// a `import.meta.glob` map; that defeated the bundler's static analysis and
// forced every page to ship every SVG. The shared renderer below is the only
// surface left, and it is consumed exclusively through `@/ui/icons/icons`.

export interface ParsedIcon {
  /** Markup between the opening `<svg>` tag and the closing `</svg>`. */
  inner: string
  /** The original `<svg ...>` opening-tag attributes, minus width/height/class/fill. */
  attrs: string
}

export function parseSvg(raw: string): ParsedIcon {
  const openMatch = raw.match(/<svg\b([^>]*)>/i)
  if (!openMatch) {
    throw new Error('Failed to parse SVG: missing <svg> element')
  }
  const rawAttrs = openMatch[1] ?? ''
  const closeIdx = raw.lastIndexOf('</svg>')
  const inner = closeIdx === -1 ? '' : raw.slice(openMatch.index! + openMatch[0].length, closeIdx)

  // Strip width/height/class/fill so our own props win; everything else (viewBox,
  // xmlns, preserveAspectRatio) is preserved verbatim.
  const attrs = rawAttrs.replace(/\s+(width|height|class|fill)\s*=\s*("[^"]*"|'[^']*')/gi, '').trim()

  return { inner, attrs }
}

export interface RenderInlineIconOptions {
  icon: ParsedIcon
  name: string
  size?: string | number
  title?: string
  className?: string
}

// Shared HTML construction used by every per-icon component. Keeps the
// `<svg ... fill="currentColor">` envelope identical to the previous
// string-keyed `Icon` so existing CSS selectors (`.icon`, `.icon-<name>`)
// still match.
export function renderInlineIcon({ icon, name, size, title, className }: RenderInlineIconOptions) {
  const dim = size ?? '1em'
  const classList = ['icon', `icon-${name}`, className].filter(Boolean).join(' ')
  const titleMarkup = title ? `<title>${escapeHtml(title)}</title>` : ''
  const role = title ? 'img' : undefined
  const ariaHidden = title ? undefined : 'true'
  const svg =
    `<svg ${icon.attrs} width="${dim}" height="${dim}" class="${classList}"` +
    ` fill="currentColor" focusable="false"` +
    (role ? ` role="${role}"` : '') +
    (ariaHidden ? ` aria-hidden="${ariaHidden}"` : '') +
    `>${titleMarkup}${icon.inner}</svg>`

  return <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: svg }} />
}

export interface IconProps {
  /** CSS sizing hint applied to the rendered SVG. Defaults to `1em`. */
  size?: string | number
  /** Accessible title; if provided the icon becomes `role="img"`. */
  title?: string
  className?: string
}

// Hand-curated union of every icon currently shipped under
// `src/ui/icons/svg`. Used by `blog.config.ts` and the `<DynamicIcon>` shim
// for call sites that genuinely select an icon from runtime config (e.g.
// social link icons). The 1:1 map between this union and the named exports
// of `@/ui/icons/icons` is asserted at the bottom of `icons.tsx`.
export type IconName =
  | 'arrowup'
  | 'check'
  | 'close'
  | 'comment'
  | 'delete'
  | 'edit'
  | 'ellipsis'
  | 'eye'
  | 'github-fill'
  | 'heart-fill'
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
