// Shared "tone" + "appearance" identity for cva-driven primitives.
//
// Before this module the colour decision for a Button / Badge / Alert /
// Pagination cell lived inside each primitive's `cva()` call as a pile of
// hand-written hover/focus/active/disabled chains. That meant 7 Button
// variants, 6 Badge variants, 1 Alert variant, and Pagination's hex
// literals all evolved independently — fixing one regression risked
// drifting another.
//
// Today every primitive that has a "colour mode" dimension exposes a
// `tone` + `appearance` prop and forwards them to the host element as
// `data-tone="…"` and `data-appearance="…"` attributes. The actual
// className soup (background, foreground, border, hover state) lives in
// `toneStyles.css` next to this file, keyed off the data-attribute
// pair. New tones land in one CSS file rather than in every cva table
// that accepts them, dark-mode rebalancing is a `globals.css` token
// swap, and the cva tables only carry layout dimensions
// (size / shape / radius).
//
// Cards, Spinners, and small adornments may still hand-pick utilities
// directly when their visual is intentionally one-off.

export type Tone =
  | 'accent' // Brand teal (default action, primary call-to-action).
  | 'neutral' // Surface-tinted, low-contrast (cancel, secondary action).
  | 'inverse' // Body-foreground on surface (legacy "secondary"/"dark").
  | 'success' // Status: success.
  | 'danger' // Status: danger / destructive.
  | 'warning' // Status: warning / pending.
  | 'subtle' // Borderless, near-invisible (link-like buttons, ghost adornments).

export type Appearance = 'solid' | 'outline'

// CVA variants for a primitive's `tone` axis are empty strings — the
// className is contributed by the data-attribute selectors in
// `toneStyles.css`. Exporting the empty-keyed record from here keeps
// the consumer side honest (TS type-checks every key) without forcing
// each primitive to spell `accent: ''` seven times.
export const TONE_VARIANTS: Record<Tone, string> = {
  accent: '',
  neutral: '',
  inverse: '',
  success: '',
  danger: '',
  warning: '',
  subtle: '',
}

// Same idea for the `appearance` axis. The two `appearance` values
// reach the DOM as `data-appearance="…"` attributes; the className
// pile is contributed by `toneStyles.css`.
export const APPEARANCE_VARIANTS: Record<Appearance, string> = {
  solid: '',
  outline: '',
}

// Tone × appearance attribute bag. Spread onto a host element when a
// caller bypasses the React component wrapper and uses the cva variant
// helper directly (e.g. `<button className={buttonVariants(...)}
// {...toneAttrs('inverse', 'solid')} />`). The pair is what
// `toneStyles.css` keys off — without it, the host renders with the
// layout-only utilities and no colour at all.
export function toneAttrs(tone: Tone, appearance: Appearance): { 'data-tone': Tone; 'data-appearance': Appearance } {
  return { 'data-tone': tone, 'data-appearance': appearance }
}
