import type { RefObject } from 'react'

import { clsx } from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router'
import { twMerge } from 'tailwind-merge'

import config from '@/blog.config'
import { useIosNoZoomOnFocus } from '@/client/hooks/use-ios-no-zoom'
import { SearchIcon } from '@/ui/icons/icons'
import { Button, buttonVariants } from '@/ui/primitives/Button'
import { inputVariants } from '@/ui/primitives/Input'
import { Popup } from '@/ui/primitives/Popup'

function searchPath(raw: string): string {
  return `/search/${encodeURIComponent(raw)}`
}

// Sidebar search: "enter to submit" input that navigates to the search route.
export function SearchBar() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [value, setValue] = useState('')
  useIosNoZoomOnFocus(containerRef)

  if (!config.settings.sidebar.search) {
    return <div id="search" className="mb-10" hidden />
  }

  return (
    <div id="search" className="mb-10" ref={containerRef}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const query = value.trim()
          setValue('')
          if (query.length > 0) void navigate(searchPath(query))
        }}
      >
        <label className="block">
          <span className="sr-only">文章寻踪</span>
          <input
            type="search"
            className="relative block w-full px-4 py-2 border-0 rounded-sm bg-surface-muted shadow-none transition-[background-color,box-shadow] duration-150 ease-in-out hover:shadow-none focus:shadow-none focus:outline-0"
            placeholder="文章寻踪（输入后回车）"
            name="q"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
        </label>
      </form>
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
    if (!open) return
    const onDocClick = (event: MouseEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) return
      const popup = document.querySelector<HTMLElement>('.global-search-popup')
      if (popup?.contains(event.target as Node)) return
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
        className={twMerge(clsx(buttonVariants({ tone: 'inverse', shape: 'circle' }), 'mr-2'))}
        title="搜索"
        aria-label="打开搜索"
        onClick={(event) => {
          event.stopPropagation()
          flushSync(() => setOpen(true))
          focusPopupInput()
        }}
      >
        <span>
          <SearchIcon />
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
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement | null>(null)
  const [query, setQuery] = useState('')
  useIosNoZoomOnFocus(formRef, open)

  useEffect(() => {
    if (!open) {
      setQuery('')
    }
  }, [open])

  return (
    <Popup open={open} onClose={onClose} size="md" className="global-search-popup" enterImmediately>
      <form
        ref={formRef}
        className="search-dialog text-center p-3 md:p-5"
        action="/search"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = query.trim()
          if (trimmed.length === 0) return
          onClose()
          void navigate(searchPath(trimmed))
        }}
      >
        <div className="mb-3 md:mb-4">
          <input
            ref={inputRef}
            type="search"
            name="q"
            required
            enterKeyHint="search"
            className={twMerge(clsx(inputVariants({ size: 'lg' }), 'text-center'))}
            placeholder="搜索并回车"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
        <Button size="lg" type="submit" className="w-full">
          搜索
        </Button>
      </form>
    </Popup>
  )
}
