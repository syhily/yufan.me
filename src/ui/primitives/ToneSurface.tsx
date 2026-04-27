import type { ComponentPropsWithRef, ElementType, Ref } from 'react'

import type { Appearance, Tone } from '@/ui/primitives/tone'

// `<ToneSurface>` owns the data-attribute contract that the tone
// palette in `toneStyles.css` keys off. Before this primitive every
// consumer (Button, Badge, Alert, plus the four naked-CVA call sites
// in AdminCredentialsForm / QRDialog / Search / Header) had to
// remember to:
//
//   1. emit `data-tone="…"` on the host element,
//   2. emit `data-appearance="…"` on the host element,
//   3. opt out of `:hover` for non-interactive surfaces with
//      `data-static="true"` (so the cascade in `toneStyles.css`
//      skips the hover state via `:hover:not([data-static])`),
//   4. branch on `<button type="…">` so the lint rule
//      `react/button-has-type` accepts a literal at every code path.
//
// Centralising those four concerns here means each tone-aware primitive
// only has to forward the `tone` / `appearance` / `static` props and
// supply the layout-axis className from its own `cva` table.
//
// The rendered element type is configurable through `as` because
// shadcn-style primitives compose this surface for both `<button>`
// (Button / Button.Icon) and `<span>` / `<div>` (Badge / Alert) hosts.
// We default to `<div>` so the component still works without an
// explicit `as` for the most common container case.

type ToneSurfaceOwnProps<T extends ElementType> = {
  /**
   * Renderable element. Defaults to `<div>`. Pass `'button'` for
   * interactive surfaces, `'span'` for inline badges, `'a'` for
   * anchored CTAs, etc.
   */
  as?: T
  /**
   * Tone identity drives the `data-tone="…"` attribute that
   * `toneStyles.css` keys off. Defaults to `accent` so the surface
   * always has a published colour cell — a missing data-attribute
   * silently strips the surface of every fill/border/text rule.
   */
  tone?: Tone
  /**
   * Surface fill model. `solid` and `outline` map to the
   * `data-appearance="…"` attribute palette. `ghost` and `link`
   * intentionally skip the data-attribute contract because their
   * className already carries the no-fill / no-border layout
   * (`buttonVariants` continues to declare them as escape hatches).
   */
  appearance?: Appearance | 'ghost' | 'link'
  /**
   * Opt the surface out of pointer affordances so the
   * `:hover:not([data-static])` rule in `toneStyles.css` skips it.
   * Alerts and any future static banner that wants the tone palette
   * but does not invite a hover should set `static`.
   */
  static?: boolean
}

export type ToneSurfaceProps<T extends ElementType = 'div'> = ToneSurfaceOwnProps<T> &
  Omit<ComponentPropsWithRef<T>, keyof ToneSurfaceOwnProps<T>> & {
    ref?: Ref<Element>
  }

// Translate `appearance` into the data-attribute palette. `ghost` and
// `link` deliberately return `undefined` so the host element keeps the
// className from its `cva` table without picking up the tone × appearance
// cells in `toneStyles.css`.
function appearanceAttr(appearance: ToneSurfaceOwnProps<ElementType>['appearance']): Appearance | undefined {
  return appearance === 'solid' || appearance === 'outline' ? appearance : undefined
}

// `<button>` is the only host that requires an explicit `type` to
// satisfy `react/button-has-type`. `ToneSurface` accepts it as a regular
// prop and branches on the literal so the linter can verify each path.
type ButtonType = 'button' | 'submit' | 'reset'

function buttonType(value: unknown): ButtonType {
  if (value === 'submit' || value === 'reset') {
    return value
  }
  return 'button'
}

export function ToneSurface<T extends ElementType = 'div'>({
  as,
  tone = 'accent',
  appearance = 'solid',
  static: isStatic,
  ref,
  ...rest
}: ToneSurfaceProps<T>) {
  const Tag = (as ?? 'div') as ElementType
  const dataAppearance = appearanceAttr(appearance)
  const dataStatic = isStatic === true ? 'true' : undefined

  if (Tag === 'button') {
    const { type, ...buttonRest } = rest as { type?: unknown } & Record<string, unknown>
    const literalType = buttonType(type)
    if (literalType === 'submit') {
      return (
        <button
          ref={ref as Ref<HTMLButtonElement>}
          type="submit"
          data-tone={tone}
          data-appearance={dataAppearance}
          data-static={dataStatic}
          {...(buttonRest as ComponentPropsWithRef<'button'>)}
        />
      )
    }
    if (literalType === 'reset') {
      return (
        <button
          ref={ref as Ref<HTMLButtonElement>}
          type="reset"
          data-tone={tone}
          data-appearance={dataAppearance}
          data-static={dataStatic}
          {...(buttonRest as ComponentPropsWithRef<'button'>)}
        />
      )
    }
    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        data-tone={tone}
        data-appearance={dataAppearance}
        data-static={dataStatic}
        {...(buttonRest as ComponentPropsWithRef<'button'>)}
      />
    )
  }

  return <Tag ref={ref} data-tone={tone} data-appearance={dataAppearance} data-static={dataStatic} {...rest} />
}
