import type { ComponentPropsWithRef, Ref } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { type Tone, TONE_OUTLINE, TONE_SOLID } from '@/ui/primitives/tone'

// 4 orthogonal dimensions per `vercel-composition-patterns/architecture-avoid-boolean-props`:
//
//   tone        (color)   ← from `@/ui/primitives/tone`
//   appearance  (fill)    ← solid / outline / ghost / link
//   size                  ← sm / md / lg
//   shape                 ← rect / pill / circle
//
// Previously this file shipped 11 hand-rolled `variant` strings + `icon` +
// `block` boolean dimensions, which produced a ~40-cell Cartesian matrix
// and made dark-mode + regression sweeps brittle. The new shape pulls
// every colour decision out into [tone.ts](./tone.ts) so the same 4
// primitives (Button/Badge/Alert/Pagination) react together when a token
// is rebalanced.
//
// `block` and `icon` are no longer cva dimensions:
//   - block-width buttons just pass `className="w-full"` (one call site).
//   - icon-only buttons use `<Button.Icon>` (see bottom of file). The
//     square aspect + circle shape is implicit there.

// Builds the cva `compoundVariants` array. Extracted into a function so we
// can iterate `TONE_SOLID` / `TONE_OUTLINE` without spreading two arrays
// into a third (eslint-plugin-unicorn `no-useless-spread` flags that as
// an extra allocation).
function buildCompoundVariants() {
  const out: Array<{
    appearance?: 'solid' | 'outline'
    tone?: Tone
    shape?: 'pill' | 'circle'
    size?: 'sm' | 'md' | 'lg'
    class: string
  }> = []
  // tone × solid (default colour fill)
  for (const [tone, cls] of Object.entries(TONE_SOLID) as [Tone, string][]) {
    out.push({ appearance: 'solid', tone, class: cls })
  }
  // tone × outline (ghost-with-tinted-border fill)
  for (const [tone, cls] of Object.entries(TONE_OUTLINE) as [Tone, string][]) {
    out.push({ appearance: 'outline', tone, class: cls })
  }
  // shape="pill" reflows the horizontal padding so the radius reads
  // (Bootstrap's `.btn-rounded` legacy contract).
  out.push({ shape: 'pill', size: 'sm', class: 'px-5 max-md:px-4' })
  out.push({ shape: 'pill', size: 'md', class: 'px-7' })
  out.push({ shape: 'pill', size: 'lg', class: 'rounded-[4rem] px-10' })
  // shape="circle" wins over the size paddings (icon-only buttons are
  // square; we set width explicitly per size).
  out.push({ shape: 'circle', size: 'sm', class: 'w-[1.875rem] h-[1.875rem] text-[1.125rem]' })
  out.push({ shape: 'circle', size: 'md', class: 'w-8 h-8 text-[1.0625rem]' })
  out.push({
    shape: 'circle',
    size: 'lg',
    class:
      'w-11 h-11 text-[1.325rem] max-md:w-[3.125rem] max-md:h-[3.125rem] max-md:text-[1.125rem] max-lg:w-11 max-lg:h-11 max-lg:text-[1.25rem]',
  })
  return out
}

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-normal text-center align-middle border',
    'transition-colors transition-shadow duration-150 ease-in-out select-none cursor-pointer',
    'disabled:pointer-events-none disabled:opacity-65',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  ].join(' '),
  {
    variants: {
      tone: {
        accent: '',
        neutral: '',
        inverse: '',
        success: '',
        danger: '',
        warning: '',
        subtle: '',
      } satisfies Record<Tone, string>,
      appearance: {
        // `solid` / `outline` colours come from compoundVariants below so
        // the table stays aligned with `TONE_SOLID` / `TONE_OUTLINE`.
        solid: '',
        outline: '',
        // Ghost and link ignore tone deliberately — they're "no fill, no
        // border" and tone-aware variants would buy nothing visually.
        ghost: 'border-transparent bg-transparent text-foreground-muted hover:bg-surface-muted hover:text-foreground',
        link: 'border-transparent bg-transparent text-foreground-muted underline-offset-2 hover:underline hover:text-foreground',
      },
      size: {
        sm: 'text-[0.8125rem] px-3.5 py-[0.3125rem] max-md:text-xs max-md:px-2 max-md:py-1',
        md: 'text-sm px-[1.625rem] py-2 max-md:py-[0.375rem]',
        lg: 'text-[0.9375rem] px-8 py-[0.625rem] max-md:text-sm max-md:px-7 max-md:py-2',
      },
      shape: {
        rect: 'rounded-xs',
        pill: 'rounded-[5rem]',
        circle: 'rounded-full aspect-square p-0',
      },
    },
    compoundVariants: buildCompoundVariants(),
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

export function Button({ className, tone, appearance, size, shape, type, ref, ...props }: ButtonProps) {
  // The `react/button-has-type` rule rejects `type={...something dynamic...}`
  // because it can't statically prove the value is one of "button" / "submit"
  // / "reset". Branch on the prop and emit literal strings so the linter can
  // verify each path.
  if (type === 'submit') {
    return (
      <button
        ref={ref}
        type="submit"
        className={twMerge(clsx(buttonVariants({ tone, appearance, size, shape }), className))}
        {...props}
      />
    )
  }
  if (type === 'reset') {
    return (
      <button
        ref={ref}
        type="reset"
        className={twMerge(clsx(buttonVariants({ tone, appearance, size, shape }), className))}
        {...props}
      />
    )
  }
  return (
    <button
      ref={ref}
      type="button"
      className={twMerge(clsx(buttonVariants({ tone, appearance, size, shape }), className))}
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
