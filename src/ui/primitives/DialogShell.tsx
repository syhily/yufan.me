import type { ReactNode, RefObject } from 'react'

import { Dialog } from '@base-ui/react/dialog'

import { CloseIcon } from '@/ui/icons/icons'
import { cn } from '@/ui/lib/cn'

// `<DialogShell>` collapses the previous `Popup` / `QRDialog` /
// `SearchPopup` family into a single Base UI Dialog scaffold:
//
//   Dialog.Root → Dialog.Portal → Dialog.Backdrop → Dialog.Popup
//                       ↓
//                  inner card (animated)
//                       ↓
//                  fixed close button + content slot
//
// Each previous primitive mounted a slightly different copy of this
// scaffold. The drift surfaced as: (1) `Popup` and `QRDialog` shipped
// different `data-[ending-style]:-translate-y-10` chains, (2) `Popup`
// declared an `enterImmediately` prop that the implementation ignored,
// and (3) `SearchIconButton` doubled Base UI's outside-click handler
// with a `document.addEventListener('click')` of its own. Centralising
// the shell here removes every one of those drift sources.
//
// Behaviour-shaping props:
//
//   - `align` — `top` (default, matches the legacy `Popup` layout) vs
//     `center` (matches `QRDialog` and `SearchPopup`'s legacy popup).
//   - `size`  — controls both the body-width clamp and the inner-card
//     padding. `flush` is the legacy `nopd` size (zero padding).
//   - `trigger` — passed through as a sibling of `Dialog.Portal` so
//     the caller controls the `Dialog.Trigger` slot. We do not wrap
//     it because triggers can be a button, a render-prop, or a
//     custom slot — and Base UI's `Dialog.Trigger` already handles
//     the popover wiring.

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'flush'

const BODY_SIZE: Record<DialogSize, string> = {
  sm: 'w-auto max-w-[300px]',
  md: 'max-w-[540px]',
  lg: 'max-w-[750px]',
  xl: 'h-screen md:h-auto md:max-w-[670px] lg:max-w-[790px]',
  flush: 'w-[75%] max-w-[340px]',
}

const CONTENT_SIZE: Record<DialogSize, string> = {
  sm: 'p-7 px-10',
  md: 'p-7',
  lg: 'p-7',
  xl: 'p-7 w-full h-screen overflow-hidden shadow-none rounded-none md:h-auto md:rounded-lg md:shadow-[0_0_30px_0_rgb(40_49_73/0.18)]',
  flush: 'p-0',
}

export interface DialogShellProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  size?: DialogSize
  /** Centred (`Search`, `QRDialog`) vs anchored to top (`Popup` legacy). */
  align?: 'center' | 'top'
  className?: string
  trigger?: ReactNode
  /**
   * Element to focus when the dialog opens. Forwarded to Base UI's
   * `Dialog.Popup` `initialFocus`. `SearchPopup` reaches for this so
   * the search input takes focus immediately, which previously
   * required a `flushSync` + `focus()` dance in the trigger handler.
   */
  initialFocus?: RefObject<HTMLElement | null>
  children: ReactNode
}

export function DialogShell({
  open,
  onOpenChange,
  size = 'sm',
  align = 'top',
  className,
  trigger,
  initialFocus,
  children,
}: DialogShellProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger}
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            'fixed inset-0 z-(--z-drawer) bg-overlay-scrim',
            'transition-opacity duration-200 ease-out',
            'data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
          )}
        />
        <Dialog.Popup
          initialFocus={initialFocus}
          className={cn(
            'fixed inset-0 z-(--z-drawer) flex justify-center px-4 py-8 pointer-events-none',
            align === 'center' ? 'items-center' : 'items-start overflow-x-hidden overflow-y-auto',
            className,
          )}
        >
          <div
            className={cn(
              'pointer-events-auto relative w-[95%] md:w-full',
              'transition-all duration-300 ease-in-out',
              'data-[ending-style]:-translate-y-10 data-[ending-style]:opacity-0',
              'data-[starting-style]:-translate-y-10 data-[starting-style]:opacity-0',
              BODY_SIZE[size],
            )}
          >
            <Dialog.Close
              className={cn(
                'fixed bottom-0 left-0 z-(--z-overlay) flex w-full translate-y-1/4 items-center justify-center',
                'appearance-none border-0 bg-transparent p-0 cursor-pointer',
              )}
              aria-label="关闭"
            >
              <CloseIcon size={28} className="inline-block align-middle text-white" />
            </Dialog.Close>
            <div className={cn('relative rounded-lg bg-white text-foreground', CONTENT_SIZE[size])}>{children}</div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
