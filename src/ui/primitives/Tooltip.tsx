import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
  type SyntheticEvent,
} from 'react'
import { createPortal } from 'react-dom'

import '@/assets/styles/vendor/tooltip.css'

const GAP = 8

export interface TooltipProps {
  children: ReactElement
  content: ReactNode
  placement?: 'top' | 'left'
}

interface TooltipPosition {
  left: number
  top: number
}

interface RefCarrier {
  ref?: Ref<HTMLElement>
}

type EventHandler = (event: SyntheticEvent) => void

export function Tooltip({ children, content, placement = 'top' }: TooltipProps) {
  const id = useId()
  const triggerRef = useRef<HTMLElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const hasContent = content !== null && content !== undefined && content !== false && content !== ''

  useEffect(() => {
    if (!visible) return

    const update = () => {
      const trigger = triggerRef.current
      const tooltip = tooltipRef.current
      if (!trigger || !tooltip) return
      setPosition(place(trigger, tooltip, placement))
    }
    const hide = () => setVisible(false)

    update()
    window.addEventListener('resize', hide)
    window.addEventListener('scroll', hide, { passive: true })
    return () => {
      window.removeEventListener('resize', hide)
      window.removeEventListener('scroll', hide)
    }
  }, [placement, visible, content])

  if (!isValidElement(children)) return children

  const child = children as ReactElement<Record<string, unknown>> & RefCarrier
  const show = () => {
    if (!hasContent) return
    setPosition(null)
    setVisible(true)
  }
  const hide = () => setVisible(false)

  return (
    <>
      {cloneElement(child, {
        ref: (node: HTMLElement | null) => {
          triggerRef.current = node
          assignRef(child.ref, node)
        },
        'aria-describedby': visible && hasContent ? id : child.props['aria-describedby'],
        onBlur: composeEventHandler(child.props.onBlur, hide),
        onFocus: composeEventHandler(child.props.onFocus, show),
        onMouseEnter: composeEventHandler(child.props.onMouseEnter, show),
        onMouseLeave: composeEventHandler(child.props.onMouseLeave, hide),
      })}
      {visible &&
        hasContent &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            id={id}
            className={`site-tooltip site-tooltip-${placement}`}
            role="tooltip"
            style={{
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              visibility: position === null ? 'hidden' : undefined,
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}

function composeEventHandler(handler: unknown, next: EventHandler): EventHandler {
  return (event) => {
    if (typeof handler === 'function') {
      ;(handler as EventHandler)(event)
    }
    if (!event.isDefaultPrevented()) next(event)
  }
}

function assignRef(ref: Ref<HTMLElement> | undefined, value: HTMLElement | null): void {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref !== null && ref !== undefined) {
    ref.current = value
  }
}

function place(target: HTMLElement, tooltip: HTMLElement, placement: 'top' | 'left'): TooltipPosition {
  const rect = target.getBoundingClientRect()
  const tip = tooltip.getBoundingClientRect()
  const scrollX = window.scrollX
  const scrollY = window.scrollY

  let top: number
  let left: number
  if (placement === 'left') {
    top = scrollY + rect.top + rect.height / 2 - tip.height / 2
    left = scrollX + rect.left - tip.width - GAP
  } else {
    top = scrollY + rect.top - tip.height - GAP
    left = scrollX + rect.left + rect.width / 2 - tip.width / 2
  }

  left = Math.max(scrollX + GAP, Math.min(left, scrollX + window.innerWidth - tip.width - GAP))
  top = Math.max(scrollY + GAP, top)
  return { left, top }
}
