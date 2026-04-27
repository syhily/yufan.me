import type { ReactNode } from 'react'

import { Dialog } from '@base-ui/react/dialog'

import { CloseIcon } from '@/ui/icons/icons'
import { cn } from '@/ui/lib/cn'

export type PopupSize = 'sm' | 'md' | 'lg' | 'xl' | 'nopd'

export interface PopupProps {
  open: boolean
  onClose: () => void
  size?: PopupSize
  className?: string
  /**
   * Render the opened state immediately so controls can be focused during
   * the opener click. Kept for API parity with the previous Popup; Base UI
   * `Dialog` handles `initialFocus` / focus management directly when the
   * caller passes the relevant ref to the popup contents.
   */
  enterImmediately?: boolean
  children: ReactNode
}

const POPUP_BODY_SIZE: Record<PopupSize, string> = {
  sm: 'w-auto max-w-[300px]',
  md: 'max-w-[540px]',
  lg: 'max-w-[750px]',
  xl: 'h-screen md:h-auto md:max-w-[670px] lg:max-w-[790px]',
  nopd: 'w-[75%] max-w-[340px]',
}

const POPUP_CONTENT_SIZE: Record<PopupSize, string> = {
  sm: 'p-7 px-10',
  md: 'p-7',
  lg: 'p-7',
  xl: 'p-7 w-full h-screen overflow-hidden shadow-none rounded-none md:h-auto md:rounded-lg md:shadow-[0_0_30px_0_rgb(40_49_73/0.18)]',
  nopd: 'p-0',
}

// Centered modal shell, now backed by Base UI's `Dialog` primitive. The
// public API (`open`, `onClose`, `size`, `className`, `enterImmediately`,
// `children`) is preserved so call sites do not change. Base UI handles
// focus trap, escape key, scroll lock, and return-focus for us — see
// https://base-ui.com/react/components/dialog.
export function Popup({ open, onClose, size = 'sm', className, children }: PopupProps) {
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onClose()
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            'fixed inset-0 z-(--z-drawer) bg-overlay-scrim',
            'transition-opacity duration-200 ease-out',
            'data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
          )}
        />
        <Dialog.Popup
          className={cn(
            'fixed inset-0 z-(--z-drawer) flex items-start justify-center overflow-x-hidden overflow-y-auto py-8',
            'pointer-events-none',
            className,
          )}
        >
          <div
            className={cn(
              'pointer-events-auto relative w-[95%]',
              'transition-all duration-300 ease-in-out',
              'data-[ending-style]:-translate-y-10 data-[ending-style]:opacity-0',
              'data-[starting-style]:-translate-y-10 data-[starting-style]:opacity-0',
              'md:w-full',
              POPUP_BODY_SIZE[size],
            )}
          >
            <Dialog.Close
              className={cn(
                'fixed bottom-0 left-0 z-(--z-overlay) flex w-full translate-y-1/4 items-center justify-center',
                'appearance-none border-0 bg-transparent p-0',
                'cursor-pointer',
              )}
              aria-label="关闭"
            >
              <CloseIcon size={28} className="inline-block align-middle text-white" />
            </Dialog.Close>
            <div className={cn('relative rounded-lg bg-white text-foreground', POPUP_CONTENT_SIZE[size])}>
              {children}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
