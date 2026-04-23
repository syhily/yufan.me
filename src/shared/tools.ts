export function isNumeric(str: string): boolean {
  return /^-?\d+$/.test(str)
}

// Fisher-Yates shuffle. Returns a new array; does not mutate the input.
// Uses Math.random because callers (sidebars, friends list) only need
// rendering variety, not unpredictability.
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = items.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Lodash's `_.sampleSize`: pick `n` distinct items from `items`, in random
// order. Drop-in replacement so we no longer need to ship lodash on the
// server (~70KB of duplicated functionality for two utilities).
export function sampleSize<T>(items: readonly T[], n: number): T[] {
  if (n <= 0 || items.length === 0) return []
  if (n >= items.length) return shuffle(items)
  return shuffle(items).slice(0, n)
}

// Group an array by the result of a key function. Replaces _.groupBy for the
// (currently single) call site that needed it.
export function groupBy<T, K extends string | number>(items: readonly T[], keyFn: (item: T) => K): Record<K, T[]> {
  const result = {} as Record<K, T[]>
  for (const item of items) {
    const key = keyFn(item)
    ;(result[key] ??= []).push(item)
  }
  return result
}
