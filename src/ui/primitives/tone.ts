// Shared "tone" palette for cva-driven primitives.
//
// Before this module the colour decision for a Button / Badge / Alert /
// Pagination cell lived inside each primitive's `cva()` call as a pile of
// hand-written hover/focus/active/disabled chains. That meant 7 Button
// variants, 6 Badge variants, 1 Alert variant, and Pagination's hex
// literals all evolved independently — fixing one regression risked
// drifting another.
//
// The refactor (see `refactor-design.md` §4.1) collapses every "what
// colour" decision into a single `Tone` enum and two className tables
// (`solid` and `outline` rendering of each tone). Every primitive that
// has a "colour mode" dimension — Button, Badge, Alert, Pagination,
// Spinner — pulls from the same source so:
//
//   - new tones land in one place (avoid `architecture-avoid-boolean-props`
//     drift across primitives), and
//   - dark-mode rebalancing is purely a token change in `globals.css`,
//     never a sweep through the cva tables.
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

// Solid fills (token-driven, light + dark via `globals.css`).
//
// Hover/active states deliberately avoid stacking class strings here —
// the design system answer is "hover collapses tone with utility opacity"
// (`hover:opacity-80`) for status colours and "step toward the strong
// variant" (`hover:bg-accent-strong`) for accent tones. Token aliases
// hide the dark-mode swap entirely.
export const TONE_SOLID: Record<Tone, string> = {
  accent: 'bg-accent text-accent-fg border-accent hover:bg-accent-strong hover:border-accent-strong',
  neutral:
    'bg-surface-muted text-foreground-muted border-surface-muted hover:bg-surface hover:text-foreground hover:border-border',
  inverse: 'bg-foreground text-surface border-foreground hover:bg-foreground-soft hover:border-foreground-soft',
  success: 'bg-success text-surface border-success hover:opacity-80',
  danger: 'bg-danger text-surface border-danger hover:opacity-80',
  warning: 'bg-warning text-surface border-warning hover:opacity-80',
  subtle: 'bg-transparent text-foreground-muted border-transparent hover:bg-surface-muted hover:text-foreground',
}

// Outline / "ghost-with-tinted-border" rendering of the same tones.
// The accent variant keeps the warm `accent-soft` wash that the legacy
// `outlinePrimary` button shipped, since that wash is brand-coded (not a
// neutral surface) — the dark-mode token swaps it for a deeper teal.
export const TONE_OUTLINE: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent border-accent/30 hover:bg-accent hover:text-accent-fg hover:border-accent',
  neutral: 'bg-transparent text-foreground-muted border-border hover:bg-surface-muted hover:text-foreground',
  inverse: 'bg-transparent text-foreground border-foreground hover:bg-foreground hover:text-surface',
  success: 'bg-transparent text-success border-success hover:bg-success hover:text-surface',
  danger: 'bg-danger-soft text-danger border-danger-soft hover:bg-danger hover:text-surface hover:border-danger',
  warning: 'bg-transparent text-warning border-warning hover:bg-warning hover:text-surface',
  subtle: 'bg-transparent text-foreground-muted border-transparent hover:bg-surface-muted hover:text-foreground',
}
