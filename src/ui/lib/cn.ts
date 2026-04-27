import type { ClassValue } from 'clsx'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Canonical class-name composer recorded as `aliases.lib` in
// `components.json`. shadcn-CLI generated primitives import this helper from
// `@/ui/lib/cn`; project code must do the same so Tailwind class arbitration
// (`twMerge`) and conditional joining (`clsx`) stay in lockstep.
//
// Keeping the API identical to the upstream shadcn `cn()` (variadic
// `ClassValue[]` -> `string`) means the registry templates work without
// modification.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
