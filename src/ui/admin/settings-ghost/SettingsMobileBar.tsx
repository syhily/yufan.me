import { SearchIcon, XIcon } from 'lucide-react'
import { useRef } from 'react'
import { useNavigate } from 'react-router'

import { useSettingsSearch } from '@/ui/admin/settings-ghost/useSettingsSearch'
import { Input } from '@/ui/components/input'

export function SettingsMobileBar() {
  const navigate = useNavigate()
  const { filter, setFilter } = useSettingsSearch()
  const searchInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 bg-background p-8 lg:hidden">
      <div className="relative flex-1">
        <SearchIcon className="absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          type="text"
          placeholder="搜索设置…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-10 w-full rounded-lg border border-transparent bg-card pr-8 pl-9 text-sm shadow-sm"
          autoComplete="off"
          autoCorrect="off"
        />
        {filter ? (
          <button
            type="button"
            onClick={() => {
              setFilter('')
              searchInputRef.current?.focus()
            }}
            className="absolute top-1/2 right-2.5 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <span className="sr-only">清除搜索</span>
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        title="关闭"
        onClick={() => {
          void navigate(-1)
        }}
        className="inline-flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-6"
        >
          <line x1="0.75" y1="23.249" x2="23.25" y2="0.749" />
          <line x1="23.25" y1="23.249" x2="0.75" y2="0.749" />
        </svg>
        <span className="sr-only">关闭</span>
      </button>
    </div>
  )
}
