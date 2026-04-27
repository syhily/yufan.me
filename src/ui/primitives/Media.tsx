import type { ComponentPropsWithRef, Ref } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Replaces `.media / .media-3x2 / .media-3x1 / .media-36x17 / .media-overlay /
// .media-content` (legacy `_base.css`). The aspect-ratio ratios mirror the legacy
// `:after { padding-top: ... }` trick, but expressed declaratively via the
// modern `aspect-ratio` CSS property so the wrapper does not need any
// `position: absolute` children.
const mediaVariants = cva('relative block overflow-hidden p-0 shrink-0', {
  variants: {
    ratio: {
      '1x1': 'aspect-square',
      '3x2': 'aspect-[3/2]',
      '3x1': 'aspect-[3/1]',
      '36x17': 'aspect-[36/17]',
    },
  },
  defaultVariants: {
    ratio: '1x1',
  },
})

export type MediaVariantProps = VariantProps<typeof mediaVariants>

export interface MediaProps extends ComponentPropsWithRef<'div'>, MediaVariantProps {
  ref?: Ref<HTMLDivElement>
}

export function Media({ className, ratio, ref, ...props }: MediaProps) {
  return <div ref={ref} className={twMerge(clsx(mediaVariants({ ratio }), className))} {...props} />
}

export interface MediaContentProps extends ComponentPropsWithRef<'div'> {
  ref?: Ref<HTMLDivElement>
}

export function MediaContent({ className, ref, ...props }: MediaContentProps) {
  return (
    <div
      ref={ref}
      className={twMerge(
        clsx(
          'absolute inset-0 border-0 rounded-[inherit] bg-cover bg-no-repeat bg-center [&>img]:w-full [&>img]:h-full [&>img]:object-cover [&>img]:block',
          className,
        ),
      )}
      {...props}
    />
  )
}

export interface MediaOverlayProps extends ComponentPropsWithRef<'div'> {
  ref?: Ref<HTMLDivElement>
  /** Anchors the overlay to the top edge instead of stretching full height. */
  top?: boolean
  /** Anchors the overlay to the bottom edge instead of stretching full height. */
  bottom?: boolean
}

export function MediaOverlay({ className, top, bottom, ref, ...props }: MediaOverlayProps) {
  return (
    <div
      ref={ref}
      className={twMerge(
        clsx(
          'absolute left-0 right-0 z-(--z-card-overlay-2) flex items-center px-3 py-2',
          top ? 'top-0 bottom-auto' : bottom ? 'bottom-0 top-auto' : 'inset-0',
          className,
        ),
      )}
      {...props}
    />
  )
}

export { mediaVariants }
