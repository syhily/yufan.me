import { createContext, use, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'dark' | 'light'
}

const STORAGE_KEY = 'yf-blog-theme'
export const THEME_COOKIE = 'yf-blog-theme'

const ThemeContext = createContext<ThemeContextType | null>(null)

function setThemeCookie(resolved: 'dark' | 'light') {
  // Max-age 1 year, path=/ so the server reads it on every SSR request.
  document.cookie = `${THEME_COOKIE}=${resolved};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`
}

function applyTheme(resolved: 'dark' | 'light') {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  const meta = document.querySelector('meta[name="color-scheme"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? 'dark' : 'light')
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored && ['dark', 'light', 'system'].includes(stored)) {
      setThemeState(stored)
    }
  }, [])

  useEffect(() => {
    const resolve = () => {
      const resolved =
        theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
      applyTheme(resolved)
      setThemeCookie(resolved)
      setResolvedTheme(resolved)
    }
    resolve()

    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      mql.addEventListener('change', resolve)
      return () => mql.removeEventListener('change', resolve)
    }
  }, [theme])

  const setTheme = (next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }

  return <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextType {
  const ctx = use(ThemeContext)
  if (ctx === null) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
