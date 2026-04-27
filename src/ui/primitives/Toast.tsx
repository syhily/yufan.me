import { Toast as BaseToast } from '@base-ui/react/toast'
import { useEffect } from 'react'

import { setApiErrorListener } from '@/client/api/error-bus'
import { CloseIcon } from '@/ui/icons/icons'
import { cn } from '@/ui/lib/cn'

// Single global toast manager. We instantiate it once at module evaluation
// time (not inside `<ToastProvider>`) so non-React modules — like the
// `@/client/api/error-bus` dispatcher — can drop messages onto it before
// any UI subscriber mounts. The manager buffers `add()` calls until
// `<Toast.Provider>` is wired up to it during BaseLayout's first render,
// matching Base UI's documented "createToastManager outside React" usage:
// https://base-ui.com/react/components/toast.
const toastManager = BaseToast.createToastManager()

export interface ToastProviderProps {
  children: React.ReactNode
}

// Top-level provider that wires the global manager into the React tree.
// Mount this once per page (in `BaseLayout`). The viewport / portal sit
// inside `<ToastSurface>` so the manager itself can live anywhere in the
// tree — including a route that wants to show a toast _before_ the
// surface mounts, which Base UI handles by replaying the buffered events.
export function ToastProvider({ children }: ToastProviderProps) {
  return <BaseToast.Provider toastManager={toastManager}>{children}</BaseToast.Provider>
}

// Renders the toast viewport, the stack of currently-visible toasts, and
// subscribes the global API error bus to the manager so envelope failures
// become toast notifications. Mount this exactly once below
// `<ToastProvider>` (we mount it in `BaseLayout`).
//
// Layout / motion notes:
//  - The viewport pins to the bottom-right at desktop and to the bottom
//    on mobile, matching the existing notification surface (mobile
//    snackbars cover the full width, desktop stacks slide in from the
//    right). It opts out of pointer events on the viewport itself so
//    underlying content (e.g. a settings drawer) stays interactive
//    between toasts.
//  - Each `<Toast.Root>` exposes `data-starting-style` /
//    `data-ending-style` attributes for the enter / exit transition —
//    we map them to a slide+fade tied to the `--toast-index` CSS var so
//    the stack neatly cascades upward (rule
//    `tailwind-design-system/animations`).
export function ToastSurface() {
  return (
    <BaseToast.Portal>
      <BaseToast.Viewport
        className={cn(
          'pointer-events-none fixed inset-x-3 bottom-3 z-(--z-overlay) flex flex-col items-stretch gap-2',
          'sm:right-3 sm:bottom-3 sm:left-auto sm:w-[24rem] sm:items-end',
        )}
      >
        <ToastList />
      </BaseToast.Viewport>
    </BaseToast.Portal>
  )
}

function ToastList() {
  const { toasts } = BaseToast.useToastManager()

  useEffect(() => {
    return setApiErrorListener((payload) => {
      toastManager.add({
        title: '操作失败',
        description: payload.message,
        type: 'error',
        priority: 'high',
        timeout: 6000,
      })
    })
  }, [])

  return (
    <>
      {toasts.map((toast) => (
        <BaseToast.Root
          key={toast.id}
          toast={toast}
          className={cn(
            'pointer-events-auto relative grid w-full gap-1 rounded-lg border px-4 py-3 pr-10 text-sm shadow-lg',
            'border-primary-100 bg-white text-foreground',
            'data-[type=error]:border-red-200 data-[type=error]:bg-red-50 data-[type=error]:text-red-900',
            'data-[type=success]:border-emerald-200 data-[type=success]:bg-emerald-50 data-[type=success]:text-emerald-900',
            'transition-all duration-200 ease-out',
            'data-[ending-style]:translate-y-2 data-[ending-style]:opacity-0',
            'data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0',
          )}
        >
          <BaseToast.Title className="font-semibold leading-tight" />
          <BaseToast.Description className="text-foreground/80 leading-snug" />
          <BaseToast.Close
            className={cn(
              'absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full',
              'text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            )}
            aria-label="关闭"
          >
            <CloseIcon size={16} />
          </BaseToast.Close>
        </BaseToast.Root>
      ))}
    </>
  )
}
