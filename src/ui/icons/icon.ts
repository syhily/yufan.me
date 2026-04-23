// Client-side icon helper for plain TypeScript modules that build DOM by
// hand (admin panel widgets, dynamic toolbars, etc.).
//
// Uses Vite's `?raw` query so each SVG ships exactly once as a string and is
// injected via `innerHTML` into a freshly created `<span class="icon">` host.
// The host carries the same `icon-<name>` class used by `<Icon>.astro`, so
// CSS sizing and color rules apply uniformly.

const modules = import.meta.glob<string>('@/assets/icons/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
})

const icons: Record<string, string> = {}
for (const [path, raw] of Object.entries(modules)) {
  const name = path
    .split('/')
    .pop()!
    .replace(/\.svg$/, '')
  icons[name] = raw
}

export function iconElement(name: string, className?: string): HTMLSpanElement {
  const svg = icons[name]
  if (!svg) {
    throw new Error(`Unknown icon: ${name}. Add the SVG to src/assets/icons/${name}.svg`)
  }
  const span = document.createElement('span')
  span.className = ['icon', `icon-${name}`, className].filter(Boolean).join(' ')
  span.setAttribute('aria-hidden', 'true')
  span.innerHTML = svg
  return span
}
