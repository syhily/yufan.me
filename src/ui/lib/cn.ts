import type { ClassValue } from 'clsx'

import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Canonical class-name composer recorded as `aliases.lib` in
// `components.json`. shadcn-CLI generated primitives import this helper from
// `@/ui/lib/cn`; project code must do the same so Tailwind class arbitration
// (`twMerge`) and conditional joining (`clsx`) stay in lockstep.
//
// Custom font-size tokens (`--text-md`, `--text-prose`, `--text-card-title`,
// `--text-h0`, `--text-page-title`) declared in `globals.css`'s `@theme`
// block generate matching `text-X` utilities. Without this `extend` block,
// `tailwind-merge` cannot tell them apart from `text-foreground` /
// `text-accent` / etc. (text *colour*) utilities — both share the `text-`
// prefix — and would let one cancel the other when both appear on the
// same element. Registering the size tokens under `font-size` keeps
// `<h1 class="text-foreground text-h0">` working as authored.
const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': ['text-md', 'text-prose', 'text-card-title', 'text-h0', 'text-page-title'],
    },
  },
})

// Keeping the API identical to the upstream shadcn `cn()` (variadic
// `ClassValue[]` -> `string`) means the registry templates work without
// modification.
export function cn(...inputs: ClassValue[]): string {
  return customTwMerge(clsx(inputs))
}
