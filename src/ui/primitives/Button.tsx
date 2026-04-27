import type { ComponentPropsWithRef, Ref } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/ui/lib/cn'
import { APPEARANCE_VARIANTS, TONE_VARIANTS, type Appearance } from '@/ui/primitives/tone'
import { ToneSurface } from '@/ui/primitives/ToneSurface'

// 4 orthogonal dimensions per `vercel-composition-patterns/architecture-avoid-boolean-props`:
//
//   tone        (color)   ← serialised to `data-tone="…"`
//   appearance  (fill)    ← serialised to `data-appearance="…"`
//                            (or kept as a className for `ghost` / `link`)
//   size                  ← sm / md / lg
//   shape                 ← rect / pill / circle
//
// Tone × appearance colour cells live in `toneStyles.css`, keyed off
// the pair of data-attributes. The cva table here only ships the
// layout-axis classes (size / shape / radius). `ghost` and `link`
// share the data-appearance escape hatch — they intentionally ignore
// `tone`, so they keep their full className chain inline below.
//
// `block` and `icon` are no longer cva dimensions:
//   - block-width buttons just pass `className="w-full"` (one call site).
//   - icon-only buttons use `<Button.Icon>` (see bottom of file). The
//     square aspect + circle shape is implicit there.
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-normal text-center align-middle border',
    'transition-colors transition-shadow duration-150 ease-in-out select-none cursor-pointer',
    'disabled:pointer-events-none disabled:opacity-65',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  ].join(' '),
  {
    variants: {
      tone: TONE_VARIANTS,
      appearance: {
        ...APPEARANCE_VARIANTS,
        // Ghost and link ignore tone deliberately — they're "no fill, no
        // border" and tone-aware variants would buy nothing visually.
        ghost: 'border-transparent bg-transparent text-foreground-muted hover:bg-surface-muted hover:text-foreground',
        link: 'border-transparent bg-transparent text-foreground-muted underline-offset-2 hover:underline hover:text-foreground',
      } satisfies Record<Appearance | 'ghost' | 'link', string>,
      size: {
        sm: 'text-xs px-2 py-1 md:text-[0.8125rem] md:px-3.5 md:py-[0.3125rem]',
        md: 'text-sm px-[1.625rem] py-[0.375rem] md:py-2',
        lg: 'text-sm px-7 py-2 md:text-[0.9375rem] md:px-8 md:py-[0.625rem]',
      },
      shape: {
        rect: 'rounded-xs',
        pill: 'rounded-[5rem]',
        circle: 'rounded-full aspect-square p-0',
      },
    },
    compoundVariants: [
      // shape="pill" reflows the horizontal padding so the radius reads
      // (Bootstrap's `.btn-rounded` legacy contract).
      { shape: 'pill', size: 'sm', class: 'px-4 md:px-5' },
      { shape: 'pill', size: 'md', class: 'px-7' },
      { shape: 'pill', size: 'lg', class: 'rounded-[4rem] px-10' },
      // shape="circle" wins over the size paddings (icon-only buttons are
      // square; we set width explicitly per size).
      { shape: 'circle', size: 'sm', class: 'w-[1.875rem] h-[1.875rem] text-[1.125rem]' },
      { shape: 'circle', size: 'md', class: 'w-8 h-8 text-[1.0625rem]' },
      // Mobile baseline matches the legacy `max-md` clamp; sm/md tighten as the
      // viewport grows. ≥ lg falls back to the dense desktop affordance.
      {
        shape: 'circle',
        size: 'lg',
        class:
          'w-[3.125rem] h-[3.125rem] text-[1.125rem] sm:w-11 sm:h-11 sm:text-[1.25rem] lg:w-11 lg:h-11 lg:text-[1.325rem]',
      },
    ],
    defaultVariants: {
      tone: 'accent',
      appearance: 'solid',
      size: 'md',
      shape: 'rect',
    },
  },
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>

export interface ButtonProps extends ComponentPropsWithRef<'button'>, ButtonVariantProps {
  ref?: Ref<HTMLButtonElement>
}

export function Button({ className, tone, appearance, size, shape, ref, ...props }: ButtonProps) {
  return (
    <ToneSurface
      as="button"
      tone={tone ?? 'accent'}
      appearance={appearance ?? 'solid'}
      ref={ref}
      className={cn(buttonVariants({ tone, appearance, size, shape }), className)}
      {...props}
    />
  )
}

// Icon-only button. The square aspect + circle shape is the project's
// default for header social links / share dialog triggers / scroll-top
// FAB; we surface them as an explicit subcomponent so call sites stop
// reaching for the legacy `icon` boolean prop and the linter can keep
// telling us when an icon-only button forgets `aria-label`.
//
// Composition note: this is a subcomponent on `Button` (not a separate
// export) per `vercel-composition-patterns`. Same primitive, different
// semantic — readers see one component family.
export type ButtonIconProps = Omit<ButtonProps, 'shape'> & {
  /** The icon-only button is always circular. Override only if you must. */
  shape?: ButtonProps['shape']
}

export function ButtonIcon({ shape, ...props }: ButtonIconProps) {
  return <Button shape={shape ?? 'circle'} {...props} />
}

// Compound API: `<Button.Icon>`.
//
// JSX prefers `<Button.Icon>` over `<ButtonIcon>` for the same reason as
// `<Tabs.Trigger>` etc. — keeps the visual + the semantic together at
// the call site without forcing a second import.
Button.Icon = ButtonIcon

export { buttonVariants }
