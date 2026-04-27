import type { ReactNode } from 'react'

import { createContext, useContext } from 'react'

import type { BlogConfig } from '@/blog.config'

// `SiteConfigContext` exposes the active site configuration (title, navigation,
// socials, sidebar/comment knobs, …) to UI components so they don't have to
// reach for the static `@/blog.config` import at module load time.
//
// The value is shaped like the existing `BlogConfig` type so callers don't have
// to learn a new schema — only the *delivery mechanism* changes (props/context
// instead of a top-of-file import). The longer-term motivation is twofold:
//
// 1. The blog config is slated to migrate to a database-backed source (see the
//    `blog.config.ts` header comment). When that happens, the only call site
//    that has to change is `<SiteConfigProvider value={…} />` in `root.tsx`.
//    Domain UI keeps reading `useSiteConfig()` unchanged.
// 2. Component-level tests can pass an inline mock without spinning up the
//    real config (which itself transitively pulls in the icon registry).
//
// `null` is the unprovided sentinel; `useSiteConfig()` throws when used outside
// `<SiteConfigProvider>` so missing wiring fails loudly during dev rather than
// silently returning a stale fallback.
const SiteConfigContext = createContext<BlogConfig | null>(null)

export interface SiteConfigProviderProps {
  value: BlogConfig
  children: ReactNode
}

export function SiteConfigProvider({ value, children }: SiteConfigProviderProps) {
  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>
}

export function useSiteConfig(): BlogConfig {
  const config = useContext(SiteConfigContext)
  if (!config) {
    throw new Error(
      'useSiteConfig() called outside <SiteConfigProvider>. Wrap the tree in <BaseLayout> (which mounts the provider) or render the component inside <SiteConfigProvider value={…}>.',
    )
  }
  return config
}
