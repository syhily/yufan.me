import type { RefObject } from 'react'

import { SearchIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Form } from 'react-router'

import { useIosNoZoomOnFocus } from '@/client/hooks/use-ios-no-zoom'
import { useSidebarSettings } from '@/ui/lib/blog-config-context'
import { cn } from '@/ui/lib/cn'
import { btnBase, btnBlock, btnLg, btnPrimary, btnSocial } from '@/ui/primitives/btn'
import { formControlInputLgClass } from '@/ui/primitives/formControl'
import { Popup } from '@/ui/primitives/Popup'

// Sidebar search: real GET form first, React Router navigation second.

// `<input className="search-field search-sidebar">` chip. Replaces the
// legacy `.widget-search .search-field { position: relative; display:
// block; width: 100%; padding: 0.5rem 1rem; border: 0; border-radius:
// var(--radius-sm); background-color: var(--bg-light); box-shadow:
// none; transition: background-color/box-shadow 0.15s ease-in-out }`
// + `:hover, :focus { border-color: var(--border-muted); box-shadow:
// none; outline: 0 }` rules. The base `var(--bg-light)` → `bg-
// surface`; the `:hover/:focus` `border-color: var(--border-muted)`
// is a no-op (the chip starts with `border: 0`, so changing its
// border-color leaves nothing to colour) — preserved for parity with
//
// `box-shadow: none` and `outline: 0` are both already the browser
// default for `<input type="search">` (Chromium ships no shadow,
// Safari/Firefox `<input>` outlines are owned by `input { outline:
// 0 }` in reset.css L86); preserved as `focus:shadow-none
// focus:outline-0` for parity. The `transition` line was a
// duplicated 3-rule fallback for ancient `-webkit-` prefix support;
// today's targets accept the unprefixed form, so a single
// `transition-colors` at the default `150ms ease-in-out` is the
// 1:1 modern equivalent.
//
// `search-field` and `search-sidebar` literals stay on the `<input>`
// as WP-compat markers (no CSS rule of their own).
const sidebarSearchInputClass = cn(
  'search-field search-sidebar',
  'relative block w-full',
  'rounded-sm border-0 px-4 py-2',
  'bg-surface',
  'transition-colors',
  'hover:border-line-muted focus:border-line-muted',
  'focus:shadow-none focus:outline-0',
)

export function SearchBar() {
  const { sidebar } = useSidebarSettings()
  const containerRef = useRef<HTMLDivElement | null>(null)
  useIosNoZoomOnFocus(containerRef)

  if (!sidebar.search) {
    return <div id="search" className="widget-search mb-10" hidden />
  }

  return (
    <div id="search" className="widget-search mb-10" ref={containerRef}>
      <Form method="get" action="/search" className="search-form">
        {/* `block` replaces the legacy `.widget-search label
            { display: block }`; without it the inline `<label>`
            collapses around its hidden `<span>` and the input
            row loses its 100%-width baseline. */}
        <label className="block">
          {/*
            `hidden` preserves the legacy `.widget-search
            .screen-reader-text { display: none }` override that
            sat on top of the base `.screen-reader-text` visually-
            hidden helper. Note: `display: none` removes the
            `<span>` from the accessibility tree as well, so this
            input has no programmatic name today; the `placeholder`
            is the only hint a screen reader hears. A full fix
            would switch to a visually-hidden `<label>` (or
            `aria-label`) so the input announces "文章寻踪".
          */}
          <span className="hidden">文章寻踪</span>
          <input
            type="search"
            className={sidebarSearchInputClass}
            placeholder="文章寻踪（输入后回车）"
            name="q"
            required
            enterKeyHint="search"
          />
        </label>
      </Form>
    </div>
  )
}

// Header search icon: opens a centered popup containing a search form.
export function SearchIconButton() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupInputRef = useRef<HTMLInputElement | null>(null)
  const handleClose = useCallback(() => setOpen(false), [])
  const focusPopupInput = useCallback(() => {
    popupInputRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    const onDocClick = (event: MouseEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) {
        return
      }
      const popup = document.querySelector<HTMLElement>('.global-search-popup')
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
      <button
        type="button"
        ref={triggerRef}
        // `mr-2` (= 8px) is the social-rail gap supplied by every
        // rail consumer (see `btnSocial` JSDoc in `@/ui/primitives/
        // btn`). The sole consumer of `SearchIconButton` today is
        // the public Header social rail.
        className={cn(btnSocial, 'mr-2')}
        title="搜索"
        aria-label="打开搜索"
        onClick={(event) => {
          event.stopPropagation()
          flushSync(() => setOpen(true))
          focusPopupInput()
        }}
      >
        <span className="absolute top-0 flex size-full items-center justify-center">
          <SearchIcon size="1em" aria-hidden className="m-icon-inset" />
        </span>
      </button>
      <SearchPopup open={open} onClose={handleClose} inputRef={popupInputRef} />
    </>
  )
}

interface SearchPopupProps {
  open: boolean
  onClose: () => void
  inputRef: RefObject<HTMLInputElement | null>
}

function SearchPopup({ open, onClose, inputRef }: SearchPopupProps) {
  const formRef = useRef<HTMLFormElement | null>(null)
  useIosNoZoomOnFocus(formRef, open)

  return (
    <Popup open={open} onClose={onClose} size="md" className="global-search-popup">
      <Form ref={formRef} className="search-dialog text-center" method="get" action="/search" onSubmit={onClose}>
        <div className="px-4 py-4 md:px-12 md:py-8">
          <div className="mx-auto max-w-sm">
            <div className="mb-4 md:mb-6">
              <input
                ref={inputRef}
                type="search"
                name="q"
                required
                enterKeyHint="search"
                className={cn(formControlInputLgClass, 'text-center')}
                placeholder="搜索并回车"
              />
            </div>
            <button type="submit" className={cn(btnBase, btnPrimary, btnLg, btnBlock)}>
              搜索
            </button>
          </div>
        </div>
      </Form>
    </Popup>
  )
}
