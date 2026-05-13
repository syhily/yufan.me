import type { VariantProps } from 'class-variance-authority'
// `qrcode.react` ships a non-trivial encoder (ECC math, alignment tables) that
// is only needed once a reader actually opens a follow/share dialog. We pull
// the type statically so editors and grep can see the dependency, but the
// runtime import below stays dynamic so Rolldown emits it as its own chunk
// (see vercel-react-best-practices `bundle-dynamic-imports`).
import type { QRCodeSVG as QRCodeSVGComponent } from 'qrcode.react'
import type { ReactNode } from 'react'

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'

import { Button, buttonVariants } from '@/ui/components/button'
import { IconButtonContent } from '@/ui/components/icon-button-content'
import { Popup } from '@/ui/public/widgets/Popup'

export interface QRDialogProps extends VariantProps<typeof buttonVariants> {
  url: string
  name: string
  title: string
  /** Icon markup inside the trigger button (e.g. `<WechatIcon />`). */
  trigger: ReactNode
  className?: string
}

// The QR wrapper is a fixed `--size-qr-dialog` (210px) box, driven by
// `size-qr-dialog` on the wrapper. After the wrapper's `p-2`
// (8px each side) the content area shrinks to 194×194, which is what
// `qrcode.react` should render at to keep the QR modules pixel-aligned.
// `mx-auto` on the wrapper centres the fixed-width box inside the
// popup body — the parent `text-center` only centres inline
// content (the title `<div>` and the `<p>` tagline), not block
// elements like this wrapper, so without `mx-auto` the QR sits flush
// left whenever the title text is wider than the 210px QR box.
const QR_CODE_SIZE = 194

const QRCodeSVG = lazy<typeof QRCodeSVGComponent>(async () => {
  const mod = await import('qrcode.react')
  return { default: mod.QRCodeSVG }
})

// Stable `data-popup-id` for the outside-click test on document.
// Each `<QRDialog>` instance gets its own portalised `<Popup>`, but
// only one is ever open at a time so a single shared id is enough.
const QR_POPUP_ID = 'qr-dialog'

export function QRDialog({ url, name, title, trigger, variant, size, shape, className }: QRDialogProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  const handleOpen = useCallback(() => setOpen(true), [])
  const handleClose = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) {
      return
    }
    const onDocClick = (event: MouseEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) {
        return
      }
      const popup = document.querySelector<HTMLElement>(`[data-popup-id="${QR_POPUP_ID}"]`)
      if (popup?.contains(event.target as Node)) {
        return
      }
      setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [open])

  return (
    <>
      <Button
        ref={triggerRef}
        variant={variant ?? 'dark'}
        size={size ?? 'iconSm'}
        shape={shape ?? 'circle'}
        className={className ?? 'mr-2'}
        title={name}
        aria-label={title}
        onClick={handleOpen}
      >
        <IconButtonContent>{trigger}</IconButtonContent>
      </Button>
      {open && (
        <Popup open={open} onClose={handleClose} popupId={QR_POPUP_ID} aria-label={title}>
          <div className="text-center">
            <div className="text-xl leading-tight font-semibold">{title}</div>
            <p className="mt-1 mb-2 text-base">{name}</p>
            <div className="mx-auto flex size-qr-dialog items-center justify-center p-2">
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
