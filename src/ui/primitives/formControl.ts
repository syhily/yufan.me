// Public-site form-control look-and-feel (header search input,
// comment reply form fields, comment edit textarea). Replaces the
// legacy `.form-control` / `.form-control-lg` cascade with a CVA
// recipe so each call site spreads `{ control, size }` over a typed
// API instead of importing one of three string constants.
//
// `!important` policy (Stage 11 P2):
//   - Stripped. The historical `!text-ink-muted` /
//     `focus:!text-ink-secondary` / `focus:!border-line-muted`
//     modifiers existed to outrank Preflight's `<input>` /
//     `<textarea>` resets. Tailwind v4 utilities land in
//     `@layer utilities`, which beats `@layer base` Preflight per
//     the W3C cascade-layers spec REGARDLESS of selector
//     specificity, so the `!` were redundant. The cascade-layer
//     declaration in `public.css` (`@layer base, components,
//     utilities;`) is pinned by `tests/contract.boundaries` so a
//     refactor cannot drop it without surfacing a test failure.
//
// Heights:
//   - The legacy CSS forced 39px (input) / 44px (lg input) via
//     `height: calc(37px + 2px)` / `calc(42px + 2px)`. The natural
//     content height (font-size × 1.5 line-height + padding-y × 2
//     + 2 × border) lands ~4px shorter, which is the "drop
//     responsive overrides" height would have required 2-3 height
//     tokens whose only consumer is this family — so we accept the
//     ~4px trim as the trade-off for shipping fewer height tokens.
//
// Why `<input>` carries an explicit `leading-normal` but `<textarea>`
// does not: Tailwind v4 Preflight inherits `line-height` from
// `<body>` for `<input>` (no dedicated reset), whereas `<textarea>`
// already gets a `line-height: 1.5` baseline from the browser's UA
// stylesheet that's friendlier to multi-line content. The CVA
// `control: 'input'` variant adds `leading-normal`; `control:
// 'textarea'` does not.

import { cva, type VariantProps } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'

const formControlBase =
  'block w-full bg-canvas bg-clip-padding border border-line rounded-(--radius-sm) font-normal text-ink-muted placeholder:text-ink-secondary placeholder:opacity-100 disabled:bg-surface read-only:bg-surface focus:text-ink-secondary focus:border-line-muted'

const formControlVariantsRaw = cva(formControlBase, {
  variants: {
    /** Element kind. `<input>` carries an explicit `leading-normal`. */
    control: {
      input: 'leading-normal',
      textarea: '',
    },
    /**
     * Size step.
     *
     *   - `default` — 14px text, 6px/12px padding (input) or
     *     10px/12px padding (textarea — handled in compoundVariants).
     *   - `lg` — 15px text, 8px/16px padding. Sole consumer is the
     *     header search popup `<input>`.
     */
    size: {
      default: 'text-sm py-1.5 px-3',
      lg: 'text-md py-2 px-4',
    },
  },
  compoundVariants: [
    {
      // Default-sized textarea uses a taller body padding (10px) than
      // the default input (6px). The `lg` step doesn't apply to
      // textareas in any current call site; if it ever does, add a
      // matching compoundVariant rather than reusing the input pad.
      control: 'textarea',
      size: 'default',
      class: 'text-sm py-2.5 px-3',
    },
  ],
  defaultVariants: {
    control: 'input',
    size: 'default',
  },
})

export type FormControlVariantProps = VariantProps<typeof formControlVariantsRaw>

type FormControlVariantsFn = (props?: Parameters<typeof formControlVariantsRaw>[0]) => string

// Same dedup-funnel rationale as `publicButtonVariants` — the CVA
// concatenation can leave a `text-sm py-1.5 px-3` (default size) +
// `text-sm py-2.5 px-3` (textarea compound) string when both fire,
// and `tailwind-merge` collapses the duplicate same-group utilities
// down to one canonical declaration before consumers see the class.
export const formControlVariants: FormControlVariantsFn = (props) => twMerge(formControlVariantsRaw(props))
