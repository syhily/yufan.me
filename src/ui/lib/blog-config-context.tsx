import { createContext, type ReactNode, useContext } from 'react'

import type { BlogConfig } from '@/blog.config'

import config from '@/blog.config'

// `BlogConfig` was historically imported directly from `@/blog.config` by
// every UI component that needed a setting. With the admin panel writing
// runtime overrides into the database, those imports would freeze on the
// build-time defaults. This context lets the root layout inject the
// merged snapshot once per request, and every UI component reads it via
// `useBlogConfig()` instead.
//
// The default value is the static literal so consumers rendered outside
// the provider (Storybook fixtures, isolated tests, the `not-found`
// shell that may render before the provider mounts) still see the
// expected shape.
const BlogConfigContext = createContext<BlogConfig>(config)

interface BlogConfigProviderProps {
  value: BlogConfig
  children: ReactNode
}

export function BlogConfigProvider({ value, children }: BlogConfigProviderProps) {
  return <BlogConfigContext.Provider value={value}>{children}</BlogConfigContext.Provider>
}

export function useBlogConfig(): BlogConfig {
  return useContext(BlogConfigContext)
}
