// Conditional className joiner used by UI components.
//
// Plain string concatenation that drops falsy entries — kept dependency-free
// (no `clsx`, no `tailwind-merge`) because `oxlint` warns against unused
// runtime libraries and Tailwind v4 conflicts are rare enough in this project
// that authors should resolve them at the call site rather than via a 6 KB
// merge engine. Upgrade to `clsx` + `tailwind-merge` if/when a follow-up PR
// introduces a wider design-system surface that genuinely needs class
// arbitration.
export type ClassValue = string | number | false | null | undefined | readonly ClassValue[]

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = []
  for (const value of inputs) {
    push(value, out)
  }
  return out.join(' ')
}

function push(value: ClassValue, out: string[]): void {
  if (value === false || value == null || value === '') return
  if (typeof value === 'string' || typeof value === 'number') {
    out.push(String(value))
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      push(item, out)
    }
  }
}
