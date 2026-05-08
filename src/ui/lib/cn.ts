import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Project-wide `cn()`. Used by both the public-site UI primitives
// (Bootstrap-styled markup, occasional Tailwind islands) AND the
// admin shadcn/ui surface (Tailwind everywhere).
//
// Stages 1-9 ran with `extendTailwindMerge({ prefix: 'tw' })` to
// match Tailwind v4's `prefix(tw)` compile-time option — every
// utility compiled to `.tw\:…` and tailwind-merge needed to know
// dropped both: legacy Bootstrap-named partials are gone, so a
// Tailwind-named utility like `block` / `text-base` / `p-4` no
// longer collides with any hand-written `.block` / `.text-*`
// rule, and the prefix isolation is unnecessary. The default
// `twMerge` import handles the canonical Tailwind v4 utility
// namespace without configuration.

export type { ClassValue }

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
