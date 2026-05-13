import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Project-wide cn helper. Composes clsx for falsy short-circuiting
// and array/object flattening with tailwind-merge for last-wins
// deduplication of conflicting Tailwind utilities.
//
// Why we extend tailwind-merge instead of using the default twMerge:
//
// Tailwind v4 looks at the namespace prefix of each --token to decide
// what kind of utility a token can drive. --text-* drives font-size,
// --color-* drives every text/bg/border/ring/decoration color slot,
// --shadow-* drives box-shadow, and so on. The CSS pipeline therefore
// already knows that text-toc-toggle is a font-size and that
// text-ink-secondary is a color, even though they share the text-*
// utility prefix.
//
// tailwind-merge does not parse our @theme inline blocks. Out of the
// box it only knows the stock Tailwind v4 token names. Any custom
// token name -- text-toc-toggle, text-ink-secondary, shadow-card,
// shadow-tooltip, font-code, animate-shake, ... -- falls into a
// generic "unknown utility for prefix X" bucket and arbitrates
// against every other class with the same prefix as if they were
// the same group. The visible symptom is the bug we are fixing
// here: cn('text-toc-toggle text-ink-secondary') used to collapse
// to 'text-ink-secondary' alone, silently dropping the font-size.
//
// The fix is to register every project token name under the
// matching tailwind-merge theme key. Once registered, tailwind-merge
// classifies the utility into the correct group and the legacy
// "same-prefix collision" goes away. We register every namespace
// the project uses today even when no current cn() call site needs
// it, so a future regression cannot reintroduce the bug for a
// different token namespace.
//
// Token lists below mirror the @theme inline blocks in
// src/assets/styles/tailwind.css. Adding a new --text-foo, --color-foo
// or --shadow-foo token there must be paired with a matching entry
// here. The unit test in tests/unit.cn.test.ts pins the contract so
// the regression is loud at CI time.

// --text-* -- font-size scale
const TEXT_TOKENS = ['md', '2xl', 'toc-toggle', 'toc-title', 'toc-link', 'badge', 'empty-state-hero', 'btn-lg'] as const

// --color-* -- shared color scale used by text-, bg-, border-, ring-,
// decoration-, fill-, stroke-, ... utilities. Both the project-semantic
// names (canvas, surface, ink-*, brand, ...) and the shadcn slot names
// (background, primary, muted, accent, ...) live in the same scale.
const COLOR_TOKENS = [
  'accent',
  'accent-foreground',
  'alert',
  'aside-bg',
  'background',
  'border',
  'brand',
  'brand-dark',
  'brand-darker',
  'canvas',
  'card',
  'scrim',
  'skeleton-start',
  'skeleton-end',
  'card-foreground',
  'destructive',
  'destructive-foreground',
  'foreground',
  'ink-body',
  'ink-light',
  'ink-muted',
  'ink-overlay',
  'ink-secondary',
  'ink-strong',
  'input',
  'like-active',
  'like-bg',
  'like-bg-hover',
  'line',
  'line-muted',
  'muted',
  'muted-foreground',
  'popover',
  'popover-foreground',
  'popup-close-hover',
  'primary',
  'primary-foreground',
  'ring',
  'secondary',
  'secondary-foreground',
  'sidebar',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-ring',
  'surface',
  'surface-body',
  'surface-dim',
  'surface-secondary',
  'surface-soft',
  'surface-warn',
  'warn',
  'widget-border',
] as const

// --shadow-*. A few shadow names also live in the --color-* table
// e.g. shadow-card collides with color-card, shadow-like-active
// collides with color-like-active. Tailwind v4 accepts a colored
// shadow form shadow-<color>, so a token whose name lives in both
// namespaces is intentionally treated as ambiguous by tailwind-
// merge and will not collapse against another shadow utility.
// No current cn call site composes those tokens with a second
// shadow utility, so the limitation is theoretical only.
const SHADOW_TOKENS = ['card', 'like-active', 'popup-close', 'toc-toggle', 'tooltip'] as const

// --radius-* -- xs is the only project-only key; sm/md/lg/xl shadow
// the stock Tailwind v4 scale and tailwind-merge already knows them,
// but redeclaring them here is harmless and protects against an
// upstream key rename.
const RADIUS_TOKENS = ['xs', 'sm', 'md', 'lg', 'xl'] as const

// --font-* -- font-family scale
const FONT_TOKENS = ['code'] as const

// --animate-*
const ANIMATE_TOKENS = ['shake', 'comments-shimmer'] as const

// --spacing-* -- the broad spacing scale that p-, m-, gap-, top-,
// w-, h-, ... all read from when they are given a custom token.
const SPACING_TOKENS = ['badge-overlay-y', 'icon-inset', 'btn-icon-md'] as const

// Note: --leading-* is intentionally NOT registered. Tailwind v4
// links font-size and line-height through a built-in conflicting-
// class-groups rule so that text-<size> can carry an implicit
// line-height. tailwind-merge mirrors that rule, which means the
// moment a token name lives in BOTH the text and the leading scale
// e.g. --text-badge and --leading-badge a later text-badge eats
// the earlier leading-badge as if it were a redundant line-height.
// The project ships exactly one such pair, so the simplest fix is
// to leave leading-* unregistered. tailwind-merge then treats
// leading-badge as an opaque token that survives any neighbouring
// text utility, at the cost of not deduping against another
// custom leading utility -- which the project never composes.

const customTwMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [...TEXT_TOKENS],
      color: [...COLOR_TOKENS],
      shadow: [...SHADOW_TOKENS],
      radius: [...RADIUS_TOKENS],
      font: [...FONT_TOKENS],
      animate: [...ANIMATE_TOKENS],
      spacing: [...SPACING_TOKENS],
    },
  },
})

export type { ClassValue }

export function cn(...inputs: ClassValue[]): string {
  return customTwMerge(clsx(inputs))
}

// Test-only surface. The contract test in
// tests/contract.tailwind-tokens.test.ts diffs these against the
// @theme inline blocks in src/assets/styles/tailwind.css so a forgotten
// registration is caught at CI time. Do not consume this from app code.
//
// REGISTERED_NAMESPACES is the set of @theme namespaces this file
// passes to extendTailwindMerge. Adding a new namespace requires
// adding it here too so the contract test knows to diff it.
//
// OMITTED_NAMESPACES is the set of @theme namespaces that exist in
// tailwind.css but are deliberately NOT registered. The only entry
// today is `leading`, for the reason documented above. Adding to
// this list must be a conscious call: the contract test fails on
// any namespace that is neither registered nor explicitly omitted,
// so the default outcome of dropping a new --<ns>-foo token into
// tailwind.css is a CI failure that forces a decision.
export const __TOKENS_FOR_TESTS = {
  registered: {
    text: TEXT_TOKENS,
    color: COLOR_TOKENS,
    shadow: SHADOW_TOKENS,
    radius: RADIUS_TOKENS,
    font: FONT_TOKENS,
    animate: ANIMATE_TOKENS,
    spacing: SPACING_TOKENS,
  } satisfies Record<string, ReadonlyArray<string>>,
  omitted: ['leading'] as const,
} as const
