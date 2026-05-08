// Public-site button family (search submit, comment save / cancel,
// ScrollTopButton, LikeActions hearts + social shares, Header social,
// QRDialog default trigger). Replaces the legacy `.btn.btn-{primary,
// secondary,light,dark,circle,rounded,lg,icon,block,…}` cascade from
// the retired `buttons.css` / `bootstrap-compat.css` partials with a
// single CVA recipe.
//
// Why CVA:
//   - The legacy hand-rolled `cn(btnBase, btnPrimary, btnLg, btnBlock)`
//     pattern relied on call-site discipline and `!important` modifiers
//     to keep the right utilities winning. Class Variance Authority
//     turns the family into a typed recipe (`publicButtonVariants({
//     variant, size, shape, … })`) and `cn`'s underlying `tailwind-
//     merge` deduplicates conflicting Tailwind groups so the SOURCE
//     ORDER stops mattering for normal Tailwind utilities.
//   - The string constants stayed live as a transition shim — every
//     existing call site (`cn(btnBase, btnLight)`,
//     `cn(btnBase, btnSecondary, btnLg, btnRoundedLg)`, …) maps onto a
//     single `publicButtonVariants(...)` call so the migration is
//     a search-and-replace per consumer.
//
// `!important` policy (Stage 11 P2):
//   - The recipe emits ZERO `!` modifiers. Plain colourway / shape /
//     size variants ride `tailwind-merge`'s last-wins deduplication;
//     consumer-supplied data-state overrides (e.g. LikeActions's
//     `data-[liked=true]:bg-like-active`) win against the variant's
//     unconditional fill via runtime selector specificity (`[data-
//     liked=true]` adds 1 to the selector tier) rather than `!`.
//   - The contract test in `tests/contract.boundaries.test.ts`
//     pins the `@layer base, components, utilities;` declaration in
//     `public.css` so Tailwind utilities always outrank Preflight
//     (`@layer base`) and prose (`@layer components`) without `!`.
//
// Public surface:
//   - `publicButtonVariants` — the CVA recipe; consumers spread
//     `{ variant, size, shape }` over it and pass any extra utility
//     classes through `className`.
//   - Type `PublicButtonVariantProps` — `VariantProps<typeof
//     publicButtonVariants>` for prop-typing helpers that want to
//     forward variant config through React props.
//   - The historical string constants (`btnBase`, `btnPrimary`,
//     `btnLight`, `btnDark`, `btnSecondary`, `btnIcon`, `btnIconMd`,
//     `btnIconLg`, `btnCircle`, `btnRoundedLg`, `btnLg`, `btnBlock`,
//     `btnSocial`) are intentionally NOT re-exported — every call
//     site has been migrated to `publicButtonVariants(...)`.

import { cva, type VariantProps } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'

const publicButtonBase =
  'inline-block border border-transparent bg-transparent rounded-xs py-2 px-[1.625rem] max-md:py-1.5 text-center align-middle [font-size:0.875rem] whitespace-normal no-underline select-none transition-[color,background-color,border-color,box-shadow] duration-150 ease-in-out'

// `transition-colors` would be enough for most colourways, but the
// like-active pulse on `LikeActions`'s post-like swaps `box-shadow`
// too, so the base ramps the four properties together.
const publicButtonVariantsRaw = cva(publicButtonBase, {
  variants: {
    /** Solid-fill colourway. */
    variant: {
      // Brand teal → dark navy on every interactive state.
      primary:
        'text-white bg-brand border-brand hover:bg-brand-dark hover:border-brand-dark focus:bg-brand-dark focus:border-brand-dark active:bg-brand-dark active:border-brand-dark disabled:bg-brand-dark disabled:border-brand-dark disabled:opacity-40',
      // `secondary` keeps the resting fill on every interactive state
      // and only lifts the text colour to white. Used by LikeActions's
      // post-like (where the variant on its own runs the resting state
      // and `data-[liked=true]:…` flags swap the chrome to red).
      secondary:
        'text-ink-light bg-brand-darker border-brand-darker hover:text-white focus:text-white active:text-white disabled:text-white',
      // Muted neutral chip — comment cancel buttons, ScrollTopButton,
      // LikeActions share buttons.
      light:
        'text-ink-muted bg-surface-soft border-surface-soft hover:text-ink-strong focus:text-ink-strong active:text-ink-strong disabled:text-ink-strong',
      // Solid navy with the dark-navy hover lift — Header social rail,
      // QRDialog default trigger, Search popup trigger.
      dark: 'text-ink-light bg-brand-dark border-brand-dark hover:text-white hover:bg-brand-darker hover:border-brand-darker focus:text-white focus:bg-brand-darker focus:border-brand-darker active:text-white active:bg-brand-darker active:border-brand-darker disabled:text-white disabled:bg-brand-darker disabled:border-brand-darker',
    },
    /**
     * Width / height step.
     *
     *   - `default` (the implicit step) — uses `publicButtonBase`'s
     *     `0.875rem` font / `py-2` padding chain. Nothing to add.
     *   - `lg` — fluid font (`--text-btn-lg`) + `py-2.5` padding.
     *     `tailwind-merge` dedupes the `[font-size:0.875rem]` /
     *     `[font-size:var(--text-btn-lg)]` pair through its arbitrary-
     *     property handling, so source order stops mattering. Same
     *     for the `py-2` → `py-2.5` swap.
     *   - `iconSm` / `iconMd` / `iconLg` — square icon shapes. The
     *     `relative` makes the absolute-positioned inner `<span>`
     *     wrapper (the icon glyph carrier) lay out correctly.
     */
    size: {
      default: '',
      lg: '[font-size:var(--text-btn-lg)] py-2.5 max-md:py-2',
      iconSm: 'relative size-8 text-center [font-size:1.0625rem] p-0',
      iconMd: 'relative size-[2.625rem] text-center [font-size:1.25rem] p-0',
      iconLg: 'relative size-11 text-center [font-size:1.325rem] p-0',
    },
    /**
     * Corner radius.
     *
     *   - `default` — inherits `rounded-xs` from `publicButtonBase`.
     *   - `circle` — perfect circle. Pair with an `icon*` size.
     *   - `pill` — large pill (4rem). Pair with `lg` size for the
     *     post-like.
     *   - `block` — full-width block button. Sole consumer is the
     *     Search popup submit (paired with `lg`); the `px-2`
     *     resolves to the same 0.5rem the legacy `.btn-block.btn-lg`
     *     cascade produced.
     */
    shape: {
      default: '',
      circle: 'rounded-full',
      pill: 'rounded-[4rem]',
      block: 'block w-full px-2',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'default',
    shape: 'default',
  },
})

export type PublicButtonVariantProps = VariantProps<typeof publicButtonVariantsRaw>

// CVA concatenates `[base, variantClass1, variantClass2, …,
// className]` without deduplicating Tailwind utilities — so a base
// `py-2` and a `size: 'lg'` `py-2.5` both ride the output. Browsers
// resolve last-wins inside the same cascade layer, so the visual
// result is correct, but the class string carries unnecessary noise
// and makes snapshot diffs hard to read. Funnel the result through
// `tailwind-merge` to collapse same-group conflicts (`py-2 py-2.5`
// → `py-2.5`, `[font-size:0.875rem] [font-size:var(--text-btn-lg)]`
// → `[font-size:var(--text-btn-lg)]`) so consumers see a single
// canonical class string per variant combination.
type PublicButtonVariantsFn = (props?: Parameters<typeof publicButtonVariantsRaw>[0]) => string

export const publicButtonVariants: PublicButtonVariantsFn = (props) => twMerge(publicButtonVariantsRaw(props))
