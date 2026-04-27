// `qrcode.react` ships a non-trivial encoder (ECC math, alignment tables) that
// is only needed once a reader actually opens a follow/share dialog. We pull
// the type statically so editors and grep can see the dependency, but the
// runtime import below stays dynamic so Rolldown emits it as its own chunk
// (see vercel-react-best-practices `bundle-dynamic-imports`).
import type { QRCodeSVG as QRCodeSVGComponent } from 'qrcode.react'

import { Dialog } from '@base-ui/react/dialog'
import { Suspense, lazy, useState } from 'react'

import type { IconComponent } from '@/ui/icons/icons'

import { CloseIcon } from '@/ui/icons/icons'
import { cn } from '@/ui/lib/cn'
import { buttonVariants } from '@/ui/primitives/Button'
import { toneAttrs } from '@/ui/primitives/tone'

export interface QRDialogProps {
  url: string
  name: string
  title: string
  /**
   * Trigger icon component. Pass the named import directly (e.g.
   * `WechatIcon`) so the bundler tree-shakes unused icons —
   * see vercel-react-best-practices `bundle-analyzable-paths` and the
   * shadcn "Pass icons as objects, not string keys" rule.
   */
  icon: IconComponent
  /**
   * Override the trigger's className. When supplied, the consumer must also
   * supply `triggerTone` (a `toneAttrs(...)` result) so the host element
   * still emits the matching `data-tone`/`data-appearance` pair the
   * tone palette in `toneStyles.css` keys off.
   */
  className?: string
  triggerTone?: ReturnType<typeof toneAttrs>
}

const DEFAULT_TRIGGER_CLASS = cn(buttonVariants({ tone: 'inverse', shape: 'circle' }))
const DEFAULT_TRIGGER_TONE = toneAttrs('inverse', 'solid')

// The QR wrapper is 210×210 inline. After the 8px padding on each side the
// content area shrinks to 194×194, which is what `qrcode.react` renders at to
// match the previous fluid viewBox behaviour.
const QR_CODE_SIZE = 194

const QRCodeSVG = lazy<typeof QRCodeSVGComponent>(async () => {
  const mod = await import('qrcode.react')
  return { default: mod.QRCodeSVG }
})

// `<QRDialog>` reaches for Base UI's `Dialog` directly instead of the legacy
// `<Popup>` shell because it needs the same focus-trap / scroll-lock contract
// but does not need the centred close-bar layout used by `<Search>`.
export function QRDialog({ url, name, title, icon: TriggerIcon, className, triggerTone }: QRDialogProps) {
  const triggerClass = className ?? DEFAULT_TRIGGER_CLASS
  const triggerToneAttrs = triggerTone ?? DEFAULT_TRIGGER_TONE
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <button type="button" className={triggerClass} title={name} aria-label={title} {...triggerToneAttrs}>
            <span>
              <TriggerIcon />
            </span>
          </button>
        }
      />
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
            'fixed inset-0 z-(--z-drawer) flex items-center justify-center px-4 py-8',
            'pointer-events-none',
          )}
        >
          <div
            className={cn(
              'pointer-events-auto relative w-auto max-w-[300px]',
              'transition-all duration-300 ease-in-out',
              'data-[ending-style]:-translate-y-10 data-[ending-style]:opacity-0',
              'data-[starting-style]:-translate-y-10 data-[starting-style]:opacity-0',
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
            <div className="relative rounded-lg bg-white text-foreground p-7 px-10">
              <div className="text-center">
                <Dialog.Title className="text-[20px]">{title}</Dialog.Title>
                <p className="mt-1 mb-2 text-base">{name}</p>
                <div className="flex justify-center items-center p-2 w-[210px] h-[210px] mx-auto">
                  <Suspense fallback={null}>
                    <QRCodeSVG value={url} level="M" marginSize={2} size={QR_CODE_SIZE} title={title} />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
