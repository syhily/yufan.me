// Shared utility-class constants for the public-site button family
// (search submit, comment save/cancel, ScrollTopButton, LikeActions
// hearts + social shares, Header social, QRDialog default). Replaces
// the legacy `.btn.btn-{primary,secondary,light,dark,circle,rounded,
// lg,icon,block,…}` cascade from the retired `buttons.css` /
// `bootstrap-compat.css` partials with a single import surface.
//
// Composition rules:
//   - Always `cn(btnBase, <colourway>, [<modifiers>], …)` — the base
//     constant must come first; colour and modifier constants
//     compose afterwards.
//   - Double-class specificity bumps from the legacy CSS
//     (`.btn-rounded.btn-lg`, `.btn-icon.btn-md`, `.btn-icon.btn-lg`)
//     are exported as their own constants (`btnRoundedLg`,
//     `btnIconMd`, `btnIconLg`); list them AFTER the matching
//     single-class constants in the `cn(...)` chain so source order
//     replays the legacy cascade — `cn(btnBase, btnLight, btnIcon,
//     btnIconLg, btnRoundedLg)` is canonical for an icon-rounded-lg
//     button (ScrollTopButton's shape).
//   - The `[font-size:<token>]` arbitrary property keeps the
//     `<button>` line-height inheriting from `<body>` (1.5) instead
//     of pulling Tailwind v4's matching `--text-*--line-height`
//     companion. The legacy `.btn` rule never set a line-height, so
//     this preserves rendered button heights byte-equal with the
//   - `!important` modifiers below cover INTRA-CHAIN cascade (a
//     colourway flipping `btnBase`'s `bg-transparent`) and the
//     specificity recovery for double-class bumps. They no longer
//     guard against an un-layered `button { ... }` reset rule —
//     reset.css's element-selector list excludes `<button>`, so
//     Tailwind utilities land in `@layer utilities` and beat
//     preflight without help.

/** Base `.btn` rule + bootstrap-compat `.btn` reset, merged. */
export const btnBase = [
  'inline-block',
  'border',
  'border-transparent',
  'bg-transparent',
  'rounded-xs',
  'py-2',
  'px-[1.625rem]',
  'max-md:py-1.5',
  'text-center',
  'align-middle',
  '[font-size:0.875rem]',
  'whitespace-normal',
  'no-underline',
  'select-none',
  'transition-[color,background-color,border-color,box-shadow]',
  'duration-150',
  'ease-in-out',
].join(' ')

/** `.btn-primary` solid-fill colourway. */
export const btnPrimary = [
  '!text-white',
  '!bg-(--btn-primary)',
  '!border-(--btn-primary)',
  'hover:!bg-(--btn-dark)',
  'hover:!border-(--btn-dark)',
  'focus:!bg-(--btn-dark)',
  'focus:!border-(--btn-dark)',
  'active:!bg-(--btn-dark)',
  'active:!border-(--btn-dark)',
  'disabled:!bg-(--btn-dark)',
  'disabled:!border-(--btn-dark)',
  'disabled:!opacity-40',
].join(' ')

/** `.btn-secondary` solid-fill colourway. */
export const btnSecondary = [
  '!text-(--color-light)',
  '!bg-(--btn-secondary)',
  '!border-(--btn-secondary)',
  'hover:!text-white',
  'focus:!text-white',
  'active:!text-white',
  'disabled:!text-white',
].join(' ')

/** `.btn-light` muted-fill colourway. */
export const btnLight = [
  '!text-(--color-muted)',
  '!bg-(--btn-light)',
  '!border-(--btn-light)',
  'hover:!text-(--color-dark)',
  'focus:!text-(--color-dark)',
  'active:!text-(--color-dark)',
  'disabled:!text-(--color-dark)',
].join(' ')

/** `.btn-dark` solid-navy colourway. */
export const btnDark = [
  '!text-(--color-light)',
  '!bg-(--btn-dark)',
  '!border-(--btn-dark)',
  'hover:!text-white',
  'hover:!bg-(--btn-secondary)',
  'hover:!border-(--btn-secondary)',
  'focus:!text-white',
  'focus:!bg-(--btn-secondary)',
  'focus:!border-(--btn-secondary)',
  'active:!text-white',
  'active:!bg-(--btn-secondary)',
  'active:!border-(--btn-secondary)',
  'disabled:!text-white',
  'disabled:!bg-(--btn-secondary)',
  'disabled:!border-(--btn-secondary)',
].join(' ')

/**
 * Perfectly-circular shape — radius only. Padding is intentionally
 * NOT defined: every consumer also carries `btnIcon`, whose
 * `!p-0` already pins the content box to zero width. Adding any
 * `!px-*` here would race source order against `btnIcon`'s `!p-0`
 * deduping across logical-property boundaries).
 */
export const btnCircle = '!rounded-full'

/**
 * Large pill shape — radius only. Same reasoning as `btnCircle`:
 * the icon consumer (ScrollTopButton) needs `!p-0` to flow through;
 * the non-icon consumer (LikeActions' post-like) supplies the
 * legacy `padding-inline: 2.5rem` directly via `!px-10` in its
 * own `cn()` chain. There is no single-class `btnRounded` export;
 * stand-alone 5rem pills should write `'!rounded-[5rem]'`
 * inline.
 */
export const btnRoundedLg = '!rounded-[4rem]'

/**
 * Large size step — font-size + padding-Y only. Padding-X is left
 * to the call site so the icon / block / non-icon variants each
 * `--text-btn-lg` (registered in `tailwind.css`) so the clamp()
 * expression has a single source of truth.
 */
export const btnLg = ['![font-size:var(--text-btn-lg)]', '!py-2.5', 'max-md:!py-2'].join(' ')

/**
 * Full-width block button — `display: block` + `padding-inline:
 * 0.5rem`. Sole consumer is the Search popup submit (paired with
 * `btnLg`); the `!px-2` here resolves to the same 0.5rem the legacy
 * `.btn-block.btn-lg` cascade produced because no other constant in
 * the chain redeclares `padding-inline`.
 */
export const btnBlock = ['!block', 'w-full', '!px-2'].join(' ')

/**
 * Icon-button base (32px square, `padding: 0`). Pair with
 * `btnIconMd` / `btnIconLg` for the larger square sizes. The `!`
 * modifiers on size / font-size / padding let `btnIcon` override
 * `btnBase` regardless of `cn(...)` argument order; the `relative`
 * positioning is for the absolute-positioned inner `<span>`
 * wrapper that consumers render to centre the icon glyph.
 */
export const btnIcon = ['relative', '!size-8', 'text-center', '![font-size:1.0625rem]', '!p-0'].join(' ')

/** `.btn-icon.btn-md` double-class specificity bump (2.625rem size, 1.25rem font). */
export const btnIconMd = ['!size-[2.625rem]', '![font-size:1.25rem]'].join(' ')

/** `.btn-icon.btn-lg` double-class specificity bump (2.75rem size, 1.325rem font). */
export const btnIconLg = ['!size-11', '![font-size:1.325rem]'].join(' ')

/**
 * Social-network round button. Three live consumers, all rendered
 * into the public Header social rail today: the inline `<a>` direct-
 * link button (Header.tsx), the QRDialog default trigger
 * (QRDialog.tsx — `DEFAULT_CLASS`), and the Search popup trigger
 * (Search.tsx — `SearchIconButton`).
 *
 * The 8px inter-button gap is NOT bundled into this constant — each
 * consumer adds it separately (`cn(btnSocial, 'mr-2')`) so an off-
 * rail consumer (e.g. a future sidebar widget that just wants the
 * round social shape) can opt out without an `!`-modifier override
 * fight. All three current consumers happen to need the gap because
 * they ALL sit in the Header rail; the discipline is intentional
 * anti-drift insurance, not redundancy.
 */
export const btnSocial = [btnBase, btnDark, btnIcon, btnCircle].join(' ')
