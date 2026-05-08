// Shared utility-class constants for the public-site form-control
// look-and-feel (header search input, comment reply form fields,
// comment edit textarea). Replaces the legacy `.form-control` /
// `.form-control-lg` CSS rules with three exported chains so the same
// 14-utility expression doesn't get copy-pasted into eight call sites.
//
// Why the four `!…` modifiers (`!text-ink-muted`,
// `focus:!text-ink-secondary`, `focus:!border-line-muted`):
// these are belt-and-braces against future `@layer base` writes
// (Tailwind v4 Preflight + any author element-reset that may land
// later). Per the W3C cascade-layers spec, layered IMPORTANT beats
// layered NORMAL regardless of selector specificity; the bangs lift
// the four colour / border declarations into the IMPORTANT tier so
// they outrank both Preflight (`@layer base`) and any future
// element-targeted reset on `input` / `textarea`. The legacy
// `.form-control` / `.form-control:focus` rules achieved the same
// outcome via plain specificity (un-layered `.form-control` class
// beating the un-layered `input` element selector) — porting the
// guarantee to layered IMPORTANT is the cleanest cascade-layers-
// compliant translation.
//
// color }` and `:focus { outline: 0 }` rules from `reset.css`, so
// the bangs no longer have to beat un-layered NORMAL specifically —
// but keeping them protects against the rule shape returning in
// Preflight or in a future shadcn theme update.)
//
// Heights: the legacy CSS forced 39px (input) / 44px (lg input) via
// `height: calc(37px + 2px)` / `calc(42px + 2px)`; the natural content
// height (font-size × 1.5 line-height + padding-y × 2 + 2 × border)
// lands ~4px shorter, which is the "drop responsive overrides"
// height would have required 2-3 height tokens whose only consumer is
// this family.

// Style toggles shared across every form-control flavour. Order matches
// the way Tailwind v4 conventionally groups utilities (positioning →
// layout → box model → typography → state) and keeps the sequence
// stable across the three exported chains.
const FORM_CONTROL_BASE = [
  'block',
  'w-full',
  'bg-canvas',
  'bg-clip-padding',
  'border',
  'border-line',
  'rounded-(--radius-sm)',
  'font-normal',
  '!text-ink-muted',
  'placeholder:text-ink-secondary',
  'placeholder:opacity-100',
  'disabled:bg-surface',
  'read-only:bg-surface',
  'focus:!text-ink-secondary',
  'focus:!border-line-muted',
].join(' ')

// `<input>` callers need `leading-normal` explicitly because Tailwind
// v4 Preflight inherits `line-height` from `<body>` for `<input>` (no
// dedicated reset), whereas `<textarea>` already gets a `line-height:
// 1.5` baseline from the browser's UA stylesheet that's friendlier to
// multi-line content. We keep the textarea exports lean (one fewer
// utility on the rendered class list, less work for tailwind-merge)
// and let the UA + Preflight chain carry the textarea line-height.
const FORM_CONTROL_INPUT_BASE = `${FORM_CONTROL_BASE} leading-normal`

/** Default `<input>` form-control: 14px text, 6px/12px padding. */
export const formControlInputClass = `${FORM_CONTROL_INPUT_BASE} text-sm py-1.5 px-3`

/** Default `<textarea>` form-control: 14px text, 10px/12px padding (taller body). */
export const formControlTextareaClass = `${FORM_CONTROL_BASE} text-sm py-2.5 px-3`

/** Larger `<input>` form-control (header search popup): 15px text, 8px/16px padding. */
export const formControlInputLgClass = `${FORM_CONTROL_INPUT_BASE} text-md py-2 px-4`
