import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type SearchComponentId = string & { __brand: 'SearchComponentId' }

export function createSearchComponentId(base: string, unique: string): SearchComponentId {
  return `${base}-${unique}` as SearchComponentId
}

export interface SettingsSearchService {
  filter: string
  setFilter: (value: string) => void
  checkVisible: (keywords: string[]) => boolean
  highlightKeywords: (text: ReactNode) => ReactNode
  noResult: boolean
  setNoResult: (value: boolean) => void
  registerComponent: (id: SearchComponentId, keywords: string[]) => void
  unregisterComponent: (id: SearchComponentId) => void
  getVisibleComponents: () => Set<SearchComponentId>
  isOnlyVisibleComponent: (id: SearchComponentId) => boolean
}

const SettingsSearchContext = createContext<SettingsSearchService>({
  filter: '',
  setFilter: () => {},
  checkVisible: () => true,
  highlightKeywords: (text) => text,
  noResult: false,
  setNoResult: () => {},
  registerComponent: () => {},
  unregisterComponent: () => {},
  getVisibleComponents: () => new Set<SearchComponentId>(),
  isOnlyVisibleComponent: () => false,
})

export function SettingsSearchProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState('')
  const [noResult, setNoResult] = useState(false)
  const registeredComponents = useRef<Map<SearchComponentId, string[]>>(new Map())
  const [visibleComponents, setVisibleComponents] = useState<Set<SearchComponentId>>(new Set())

  const checkVisible = useCallback(
    (keywords: string[]) => {
      if (!keywords.length || !filter) {
        return true
      }
      const lowerFilter = filter.toLowerCase()
      return keywords.some((keyword) => keyword.toLowerCase().includes(lowerFilter))
    },
    [filter],
  )

  const registerComponent = useCallback(
    (id: SearchComponentId, keywords: string[]) => {
      registeredComponents.current.set(id, keywords)
      const isVisible = !filter || keywords.some((keyword) => keyword.toLowerCase().includes(filter.toLowerCase()))
      if (isVisible) {
        setVisibleComponents((prev) => new Set(prev).add(id))
      }
    },
    [filter],
  )

  const unregisterComponent = useCallback((id: SearchComponentId) => {
    registeredComponents.current.delete(id)
    setVisibleComponents((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  useEffect(() => {
    const newVisible = new Set<SearchComponentId>()
    const lowerFilter = filter.toLowerCase()
    registeredComponents.current.forEach((keywords, id) => {
      const isVisible = !filter || keywords.some((keyword) => keyword.toLowerCase().includes(lowerFilter))
      if (isVisible) {
        newVisible.add(id)
      }
    })
    setVisibleComponents(newVisible)
  }, [filter])

  const isOnlyVisibleComponent = useCallback(
    (id: SearchComponentId) => {
      return visibleComponents.size === 1 && visibleComponents.has(id)
    },
    [visibleComponents],
  )

  const getVisibleComponents = useCallback(() => {
    return visibleComponents
  }, [visibleComponents])

  const highlightKeywords = useCallback(
    (text: ReactNode): ReactNode => {
      if (!filter) {
        return text
      }
      if (typeof text === 'string') {
        const words = filter.split(/\s+/).map((word) => word.toLowerCase())
        const wordsPattern = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
        const parts = text.split(new RegExp(`(${wordsPattern})`, 'gi'))
        return parts.map((part, i) =>
          words.includes(part.toLowerCase()) ? (
            <mark key={i} className="rounded-sm bg-yellow-500/40">
              {part}
            </mark>
          ) : (
            part
          ),
        )
      }
      if (Array.isArray(text)) {
        return text.map((part, i) => <span key={i}>{highlightKeywords(part)}</span>)
      }
      return text
    },
    [filter],
  )

  return (
    <SettingsSearchContext.Provider
      value={{
        filter,
        setFilter,
        checkVisible,
        highlightKeywords,
        noResult,
        setNoResult,
        registerComponent,
        unregisterComponent,
        getVisibleComponents,
        isOnlyVisibleComponent,
      }}
    >
      {children}
    </SettingsSearchContext.Provider>
  )
}

export function useSettingsSearchContext() {
  return useContext(SettingsSearchContext)
}

export function useSettingsSearch() {
  return useSettingsSearchContext()
}
