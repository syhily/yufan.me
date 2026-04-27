import { Dialog } from '@base-ui/react/dialog'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { useIosNoZoomOnFocus } from '@/client/hooks/use-ios-no-zoom'
import { SearchIcon } from '@/ui/icons/icons'
import { cn } from '@/ui/lib/cn'
import { Button, buttonVariants } from '@/ui/primitives/Button'
import { DialogShell } from '@/ui/primitives/DialogShell'
import { inputVariants } from '@/ui/primitives/Input'
import { useSiteConfig } from '@/ui/primitives/site-config'
import { ToneSurface } from '@/ui/primitives/ToneSurface'

function searchPath(raw: string): string {
  return `/search/${encodeURIComponent(raw)}`
}

// Sidebar search: "enter to submit" input that navigates to the search route.
export function SearchBar() {
  const { settings } = useSiteConfig()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [value, setValue] = useState('')
  useIosNoZoomOnFocus(containerRef)

  if (!settings.sidebar.search) {
    return <div id="search" className="mb-10" hidden />
  }

  return (
    <div id="search" className="mb-10" ref={containerRef}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const query = value.trim()
          setValue('')
          if (query.length > 0) {
            void navigate(searchPath(query))
          }
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

// Header search icon: opens a centred dialog containing a search form. The
// `<DialogShell>` primitive owns the focus trap, scroll lock, Escape handler,
// and outside-click dismissal — we used to maintain a parallel
// `document.addEventListener('click')` listener plus a `flushSync` focus
// dance, but Base UI's `initialFocus` and built-in dismissal cover both.
export function SearchIconButton() {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  return (
    <DialogShell
      open={open}
      onOpenChange={setOpen}
      size="md"
      align="center"
      className="global-search-popup"
      initialFocus={inputRef}
      trigger={
        <Dialog.Trigger
          render={
            <ToneSurface
              as="button"
              type="button"
              tone="inverse"
              appearance="solid"
              className={cn(buttonVariants({ tone: 'inverse', shape: 'circle' }), 'mr-2')}
              title="搜索"
              aria-label="打开搜索"
            >
              <span>
                <SearchIcon />
              </span>
            </ToneSurface>
          }
        />
      }
    >
      <SearchForm inputRef={inputRef} onSubmitted={() => setOpen(false)} />
    </DialogShell>
  )
}

interface SearchFormProps {
  inputRef: React.RefObject<HTMLInputElement | null>
  onSubmitted: () => void
}

function SearchForm({ inputRef, onSubmitted }: SearchFormProps) {
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement | null>(null)
  const [query, setQuery] = useState('')
  useIosNoZoomOnFocus(formRef, true)

  useEffect(() => {
    return () => setQuery('')
  }, [])

  return (
    <form
      ref={formRef}
      className="search-dialog text-center p-3 md:p-5"
      action="/search"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = query.trim()
        if (trimmed.length === 0) {
          return
        }
        onSubmitted()
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
          className={cn(inputVariants({ size: 'lg' }), 'text-center')}
          placeholder="搜索并回车"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </div>
      <Button size="lg" type="submit" className="w-full">
        搜索
      </Button>
    </form>
  )
}
