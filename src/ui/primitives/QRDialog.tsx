// `qrcode.react` ships a non-trivial encoder (ECC math, alignment tables) that
// is only needed once a reader actually opens a follow/share dialog. We pull
// the type statically so editors and grep can see the dependency, but the
// runtime import below stays dynamic so Rolldown emits it as its own chunk
// (see vercel-react-best-practices `bundle-dynamic-imports`).
import type { QRCodeSVG as QRCodeSVGComponent } from 'qrcode.react'

import { Dialog } from '@base-ui/react/dialog'
import { Suspense, lazy, useState } from 'react'

import type { IconComponent } from '@/ui/icons/icons'
import type { Appearance, Tone } from '@/ui/primitives/tone'

import { cn } from '@/ui/lib/cn'
import { buttonVariants } from '@/ui/primitives/Button'
import { DialogShell } from '@/ui/primitives/DialogShell'
import { ToneSurface } from '@/ui/primitives/ToneSurface'

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
   * supply `triggerTone` / `triggerAppearance` so the host element emits
   * the matching `data-tone` / `data-appearance` pair the tone palette in
   * `toneStyles.css` keys off.
   */
  className?: string
  triggerTone?: Tone
  triggerAppearance?: Appearance
}

const DEFAULT_TRIGGER_CLASS = cn(buttonVariants({ tone: 'inverse', shape: 'circle' }))
const DEFAULT_TRIGGER_TONE: Tone = 'inverse'
const DEFAULT_TRIGGER_APPEARANCE: Appearance = 'solid'

// The QR wrapper is 210×210 inline. After the 8px padding on each side the
// content area shrinks to 194×194, which is what `qrcode.react` renders at to
// match the previous fluid viewBox behaviour.
const QR_CODE_SIZE = 194

const QRCodeSVG = lazy<typeof QRCodeSVGComponent>(async () => {
  const mod = await import('qrcode.react')
  return { default: mod.QRCodeSVG }
})

// Composes the shared `<DialogShell>` (centred, sm size) with the QR-code
// content. The trigger / focus-trap / scroll-lock / Escape behaviour all
// come from `Dialog.Trigger` and the shell's Base UI scaffold; this file
// only owns the QR-specific markup.
export function QRDialog({
  url,
  name,
  title,
  icon: TriggerIcon,
  className,
  triggerTone,
  triggerAppearance,
}: QRDialogProps) {
  const triggerClass = className ?? DEFAULT_TRIGGER_CLASS
  const tone = triggerTone ?? DEFAULT_TRIGGER_TONE
  const appearance = triggerAppearance ?? DEFAULT_TRIGGER_APPEARANCE
  const [open, setOpen] = useState(false)

  return (
    <DialogShell
      open={open}
      onOpenChange={setOpen}
      size="sm"
      align="center"
      trigger={
        <Dialog.Trigger
          render={
            <ToneSurface
              as="button"
              type="button"
              tone={tone}
              appearance={appearance}
              className={triggerClass}
              title={name}
              aria-label={title}
            >
              <span>
                <TriggerIcon />
              </span>
            </ToneSurface>
          }
        />
      }
    >
      <div className="text-center">
        <Dialog.Title className="text-[20px]">{title}</Dialog.Title>
        <p className="mt-1 mb-2 text-base">{name}</p>
        <div className="flex justify-center items-center p-2 w-[210px] h-[210px] mx-auto">
          <Suspense fallback={null}>
            <QRCodeSVG value={url} level="M" marginSize={2} size={QR_CODE_SIZE} title={title} />
          </Suspense>
        </div>
      </div>
    </DialogShell>
  )
}
