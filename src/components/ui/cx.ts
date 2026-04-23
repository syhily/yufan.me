// Tiny `clsx`-style className joiner used by TSX components migrated from
// Astro's `class:list`. Accepts strings, falsy values, and arrays; ignores
// anything that isn't a non-empty string.
export type ClassValue = string | number | false | null | undefined | ClassValue[]

export function cx(...values: ClassValue[]): string {
  const out: string[] = []
  const walk = (value: ClassValue) => {
    if (!value && value !== 0) return
    if (Array.isArray(value)) {
      for (const v of value) walk(v)
      return
    }
    if (typeof value === 'string') {
      if (value !== '') out.push(value)
    } else if (typeof value === 'number') {
      out.push(String(value))
    }
  }
  for (const v of values) walk(v)
  return out.join(' ')
}
