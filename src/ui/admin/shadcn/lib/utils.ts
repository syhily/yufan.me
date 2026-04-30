import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Tailwind v4 in this project is loaded with `prefix(tw)` (see
// `src/assets/styles/tailwind.css`), so every utility compiles to
// `.tw\:…`. shadcn's default `twMerge` doesn't know about this prefix
// and would otherwise drop our prefixed utilities during merging.
//
// IMPORTANT: tailwind-merge v3 expects the prefix value WITHOUT the
// trailing separator. The colon (`tw:`) is part of Tailwind v4's
// namespace syntax that tailwind-merge handles internally, so we pass
// just `'tw'` here. Passing `'tw:'` instead silently breaks merging:
// `cn()` no longer recognises `tw:*` utilities as Tailwind classes,
// so when conflicting utilities collide inside `cva` variants
// (e.g. base `tw:gap-2` + size variant `tw:gap-1.5`) tailwind-merge
// can't dedupe them and the resulting class list ends up missing
// the spacing/sizing/etc. utilities entirely.
// See https://github.com/dcastil/tailwind-merge/issues/527.
const twMerge = extendTailwindMerge({ prefix: 'tw' })

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
