import type { ReactNode } from 'react'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { CloseIcon } from '@/ui/icons/icons'

export interface PopupProps {
  open: boolean
  onClose: () => void
  /** Extra size class (e.g. `nice-popup-md`). Defaults to `nice-popup-sm`. */
  sizeClass?: string
  /** Optional extra class added to the outer popup container. */
  className?: string
  /** Render the opened state immediately so controls can be focused during the opener click. */
  enterImmediately?: boolean
  children: ReactNode
}

// Centered modal shell. Replaces the vanilla `createDialogShell + showPopup`
// helpers from `features/popup.ts`. We defer flipping on `nice-popup-open` by
// one frame so the CSS transition plays.
export function Popup({
  open,
  onClose,
  sizeClass = 'nice-popup-sm',
  className,
  enterImmediately = false,
  children,
}: PopupProps) {
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

  const popupClass = ['nice-popup nice-popup-center', sizeClass, isEntered ? 'nice-popup-open' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return createPortal(
    <div className={popupClass}>
      <div className="nice-popup-overlay" onClick={onClose} />
      <div className="nice-popup-body">
        <button
          type="button"
          className="nice-popup-close"
          aria-label="关闭"
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
        >
          <CloseIcon size={28} className="svg-white" />
        </button>
        <div className="nice-popup-content">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
