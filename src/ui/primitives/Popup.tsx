import type { ReactNode } from 'react'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { CloseIcon } from '@/ui/icons/icons'

export type PopupSize = 'sm' | 'md' | 'lg' | 'xl' | 'nopd'

export interface PopupProps {
  open: boolean
  onClose: () => void
  /** Body width preset. Defaults to `sm`. */
  size?: PopupSize
  /** Optional extra class added to the outer popup container. */
  className?: string
  /** Render the opened state immediately so controls can be focused during the opener click. */
  enterImmediately?: boolean
  children: ReactNode
}

// Width / padding by size preset. Static literals so Tailwind's JIT can see
// every utility (per `bundle-analyzable-paths`). The sm size keeps the legacy
// `width: auto` behavior, the others use a max-width cap.
const POPUP_BODY_SIZE: Record<PopupSize, string> = {
  sm: 'w-auto max-w-[300px]',
  md: 'max-w-[540px]',
  lg: 'max-w-[750px]',
  xl: 'max-w-[790px] max-md:h-screen md:max-lg:max-w-[670px]',
  nopd: 'max-w-[340px] max-md:w-[75%]',
}

const POPUP_CONTENT_SIZE: Record<PopupSize, string> = {
  sm: 'p-7 px-10',
  md: 'p-7',
  lg: 'p-7',
  xl: 'p-7 w-full h-auto overflow-hidden max-md:shadow-none max-md:rounded-none max-md:h-screen',
  nopd: 'p-0',
}

// Centered modal shell. Replaces the vanilla `createDialogShell + showPopup`
// helpers from `features/popup.ts`. We defer flipping the open state by one
// frame so the CSS transition plays.
export function Popup({ open, onClose, size = 'sm', className, enterImmediately = false, children }: PopupProps) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    if (enterImmediately) {
      setEntered(true)
      return
    }
    const raf = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(raf)
  }, [open, enterImmediately])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null
  const isEntered = enterImmediately || entered
  const state = isEntered ? 'open' : 'closed'

  const popupClass = [
    'fixed inset-0 w-full h-full z-[1500] overflow-x-hidden overflow-y-auto flex items-center justify-center invisible opacity-0 data-[state=open]:visible data-[state=open]:opacity-100',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return createPortal(
    <div className={popupClass} data-state={state}>
      <div
        data-state={state}
        className="fixed inset-0 w-full h-screen bg-black/30 invisible opacity-0 data-[state=open]:visible data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto"
        onClick={onClose}
      />
      <div
        data-state={state}
        className={`relative w-full ${POPUP_BODY_SIZE[size]} py-8 -translate-y-10 invisible opacity-0 transition-all duration-300 ease-in-out data-[state=open]:translate-y-0 data-[state=open]:visible data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto max-md:w-[95%]`}
      >
        <button
          type="button"
          className="fixed bottom-0 left-0 w-full p-0 border-0 bg-transparent appearance-none z-[99] flex items-center justify-center translate-y-1/4"
          aria-label="关闭"
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
        >
          <CloseIcon size={28} className="inline-block align-middle text-white" />
        </button>
        <div className={`relative bg-white rounded-lg text-foreground ${POPUP_CONTENT_SIZE[size]}`}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}
