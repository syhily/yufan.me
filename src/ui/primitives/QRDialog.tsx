// `qrcode.react` ships a non-trivial encoder (ECC math, alignment tables) that
// is only needed once a reader actually opens a follow/share dialog. We pull
// the type statically so editors and grep can see the dependency, but the
// runtime import below stays dynamic so Rolldown emits it as its own chunk
// (see vercel-react-best-practices `bundle-dynamic-imports`).
import type { QRCodeSVG as QRCodeSVGComponent } from 'qrcode.react'

import { clsx } from 'clsx'
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import type { IconName } from '@/ui/icons/Icon'

import { DynamicIcon } from '@/ui/icons/icons'
import { buttonVariants } from '@/ui/primitives/Button'
import { Popup } from '@/ui/primitives/Popup'

export interface QRDialogProps {
  url: string
  name: string
  title: string
  icon: IconName
  className?: string
}

const DEFAULT_CLASS = twMerge(clsx(buttonVariants({ tone: 'inverse', shape: 'circle' })))

// The QR wrapper is 210×210 inline. After the 8px padding on each side the
// content area shrinks to 194×194, which is what `qrcode.react` renders at to
// match the previous fluid viewBox behaviour.
const QR_CODE_SIZE = 194

const QRCodeSVG = lazy<typeof QRCodeSVGComponent>(async () => {
  const mod = await import('qrcode.react')
  return { default: mod.QRCodeSVG }
})

export function QRDialog({ url, name, title, icon, className }: QRDialogProps) {
  const rootClass = className ?? DEFAULT_CLASS
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  const handleOpen = useCallback(() => setOpen(true), [])
  const handleClose = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onDocClick = (event: MouseEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) return
      const popup = document.querySelector<HTMLElement>('.qr-dialog-popup')
      if (popup?.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [open])

  return (
    <>
      <button type="button" ref={triggerRef} className={rootClass} title={name} aria-label={title} onClick={handleOpen}>
        <span>
          <DynamicIcon name={icon} />
        </span>
      </button>
      {open && (
        <Popup open={open} onClose={handleClose} className="qr-dialog-popup">
          <div className="text-center">
            <h6 className="text-[20px]">{title}</h6>
            <p className="mt-1 mb-2 text-base">{name}</p>
            <div className="flex justify-center items-center p-2 w-[210px] h-[210px] mx-auto">
              <Suspense fallback={null}>
                <QRCodeSVG value={url} level="M" marginSize={2} size={QR_CODE_SIZE} title={title} />
              </Suspense>
            </div>
          </div>
        </Popup>
      )}
    </>
  )
}
