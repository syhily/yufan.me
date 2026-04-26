// Inline SVG icon renderer for React server components.
//
// Each icon under `src/ui/icons/svg/*.svg` is eagerly imported as a raw string
// via Vite's `?raw` query. We pre-parse the opening `<svg>` tag at module load
// so we can strip out the vendor-exported sizing attributes that collide with
// our own sizing rules, and emit a bare `<svg class="icon icon-<name>" …>`
// element. Because React cannot inject a raw `<svg>` as the root of a subtree,
// we wrap it in a `display: contents` span — invisible to layout, the
// box-model, and CSS selectors that descend into `.icon`, so the rest of the
// stylesheet can stay unchanged.
//
// Since the output is plain HTML, no React runtime ships to the client
// unless the enclosing component is flagged with a `client:*` directive.

interface ParsedIcon {
  /** Markup between the opening `<svg>` tag and the closing `</svg>`. */
  inner: string
  /** The original `<svg ...>` opening-tag attributes, minus width/height/class/fill. */
  attrs: string
}

const rawModules = import.meta.glob<string>('@/ui/icons/svg/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
})

function parseSvg(raw: string): ParsedIcon {
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

// Hand-curated union of every icon currently shipped under
// `src/ui/icons/svg`. Kept explicit (rather than a generic `string`) so
// that callers like `<Icon name="…" />` are typed: typos and missing icons
// are caught at compile time instead of at render time. The runtime assert
// below makes the dev/test loop immediately surface any drift between this
// list and the actual SVG inventory.
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

const icons: Record<string, ParsedIcon> = {}
for (const [path, raw] of Object.entries(rawModules)) {
  const name = path
    .split('/')
    .pop()!
    .replace(/\.svg$/, '')
  icons[name] = parseSvg(raw)
}

// Surface drift between the on-disk SVG set and the `IconName` union early.
// In production the assertion is skipped (it would only ever throw on a
// shipped build that already typecheck-failed anyway).
if (import.meta.env.DEV) {
  const declared = new Set<string>([
    'arrowup',
    'check',
    'close',
    'comment',
    'delete',
    'edit',
    'ellipsis',
    'eye',
    'github-fill',
    'heart-fill',
    'left',
    'link',
    'menu',
    'qq',
    'refresh',
    'reply',
    'right',
    'search',
    'twitter',
    'user',
    'wechat',
    'weibo',
  ] satisfies IconName[])
  for (const name of Object.keys(icons)) {
    if (!declared.has(name)) {
      throw new Error(
        `Icon "${name}" exists under src/ui/icons/svg/ but is missing from the IconName union in src/ui/icons/Icon.tsx.`,
      )
    }
  }
}

export interface IconProps {
  name: IconName
  /** CSS sizing hint applied to the rendered SVG. Defaults to `1em`. */
  size?: string | number
  /** Accessible title; if provided the icon becomes `role="img"`. */
  title?: string
  className?: string
}

export function Icon({ name, size, title, className }: IconProps) {
  const icon = icons[name]
  if (!icon) {
    throw new Error(`Unknown icon: ${name}. Add the SVG to src/ui/icons/svg/${name}.svg`)
  }
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
