import { createContext, type ReactNode, useContext, useMemo } from 'react'

import type {
  BlogConfig,
  BlogSettingsBundle,
  CacheSettings,
  CommentsSettings,
  ContentSettings,
  FooterSettings,
  LocalizationSettings,
  MailSettings,
  NavigationSettings,
  SeoSettings,
  SidebarSettings,
  SiteIdentitySettings,
  SocialsSettings,
} from '@/shared/blog-config'

import { bundleToBlogSettings } from '@/shared/blog-config'

// Fine-grained React contexts for the live blog configuration.
//
// The settings document is bucketed by section
// (`@/shared/blog-config.ts`) and each bucket gets its own context so a
// component that only reads, say, footer copy doesn't re-render when an
// admin saves the sidebar config. `<BlogSettingsProvider />` slices the
// bundle into per-section provider values once per render and nests
// them so a single tree wrap publishes everything.
//
// The legacy aggregated `useBlogConfig()` / `useRequiredBlogConfig()`
// hooks remain available as compatibility wrappers (built on the
// `BlogConfigContext` that `BlogSettingsProvider` keeps populated).
// New consumers should prefer the per-section accessors below.

interface ContextPair<T> {
  context: React.Context<T | undefined>
  Provider: React.FC<{ value: T | undefined; children: ReactNode }>
}

function createSectionContext<T>(displayName: string): ContextPair<T> {
  const context = createContext<T | undefined>(undefined)
  context.displayName = displayName
  function Provider({ value, children }: { value: T | undefined; children: ReactNode }) {
    return <context.Provider value={value}>{children}</context.Provider>
  }
  Provider.displayName = `${displayName}.Provider`
  return { context, Provider }
}

const siteIdentity = createSectionContext<SiteIdentitySettings>('SiteIdentityContext')
const localization = createSectionContext<LocalizationSettings>('LocalizationContext')
const navigation = createSectionContext<NavigationSettings>('NavigationContext')
const socials = createSectionContext<SocialsSettings>('SocialsContext')
const content = createSectionContext<ContentSettings>('ContentSettingsContext')
const sidebar = createSectionContext<SidebarSettings>('SidebarSettingsContext')
const comments = createSectionContext<CommentsSettings>('CommentsSettingsContext')
const seo = createSectionContext<SeoSettings>('SeoSettingsContext')
const footer = createSectionContext<FooterSettings>('FooterSettingsContext')
const mail = createSectionContext<MailSettings>('MailSettingsContext')
const cache = createSectionContext<CacheSettings>('CacheSettingsContext')

// Legacy aggregated context. Default value is `undefined` because there
// is no static fallback: pre-install or render-outside-provider both
// surface as `undefined` and the consumer must guard.
const BlogConfigContext = createContext<BlogConfig | undefined>(undefined)
BlogConfigContext.displayName = 'BlogConfigContext'

// Bundle context. Convenient for the admin shell (which actually wants
// every section in one call) and the legacy wrappers below.
const BlogSettingsBundleContext = createContext<BlogSettingsBundle | undefined>(undefined)
BlogSettingsBundleContext.displayName = 'BlogSettingsBundleContext'

interface BlogSettingsProviderProps {
  /**
   * Live settings bundle from the root loader. `undefined` indicates a
   * pre-install deployment (the install gate should have intercepted
   * the request, so this only matters for the install split-screen
   * itself).
   */
  value: BlogSettingsBundle | undefined
  children: ReactNode
}

/**
 * Single root provider that publishes every section context plus the
 * legacy aggregated views. Memoises the projected `BlogConfig` so
 * `useRequiredBlogConfig()` consumers get a stable identity across
 * renders that don't actually mutate the bundle.
 */
export function BlogSettingsProvider({ value, children }: BlogSettingsProviderProps) {
  const blogConfig = useMemo(() => bundleToBlogSettings(value ?? null) ?? undefined, [value])

  return (
    <BlogSettingsBundleContext.Provider value={value}>
      <BlogConfigContext.Provider value={blogConfig}>
        <siteIdentity.Provider value={value?.siteIdentity ?? undefined}>
          <localization.Provider value={value?.localization ?? undefined}>
            <navigation.Provider value={value?.navigation ?? undefined}>
              <socials.Provider value={value?.socials ?? undefined}>
                <content.Provider value={value?.content ?? undefined}>
                  <sidebar.Provider value={value?.sidebar ?? undefined}>
                    <comments.Provider value={value?.comments ?? undefined}>
                      <seo.Provider value={value?.seo ?? undefined}>
                        <footer.Provider value={value?.footer ?? undefined}>
                          <mail.Provider value={value?.mail ?? undefined}>
                            <cache.Provider value={value?.cache ?? undefined}>{children}</cache.Provider>
                          </mail.Provider>
                        </footer.Provider>
                      </seo.Provider>
                    </comments.Provider>
                  </sidebar.Provider>
                </content.Provider>
              </socials.Provider>
            </navigation.Provider>
          </localization.Provider>
        </siteIdentity.Provider>
      </BlogConfigContext.Provider>
    </BlogSettingsBundleContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Legacy aggregated hooks (kept for incremental migration; prefer the
// per-section accessors below for new code).
// ---------------------------------------------------------------------------

/**
 * @deprecated Prefer the per-section accessors (`useSiteIdentity`,
 * `useLocalization`, …). This hook returns `undefined` outside a
 * provider AND on uninstalled deployments.
 */
export function useBlogConfig(): BlogConfig | undefined {
  return useContext(BlogConfigContext)
}

/**
 * @deprecated Prefer the per-section accessors. Strict variant of
 * `useBlogConfig` that throws when no provider is in scope.
 */
export function useRequiredBlogConfig(): BlogConfig {
  const config = useContext(BlogConfigContext)
  if (config === undefined) {
    throw new Error(
      'useRequiredBlogConfig: no <BlogSettingsProvider> in scope (or the install gate let an uninstalled request through).',
    )
  }
  return config
}

// Back-compat alias for the old provider name. Slated for removal.
/** @deprecated Use `BlogSettingsProvider` instead. */
export const BlogConfigProvider = BlogSettingsProvider

// ---------------------------------------------------------------------------
// Per-section accessors. Each section has both a strict variant
// (throws when the section hasn't been seeded — fine for sections the
// install flow always populates, like `siteIdentity`/`localization`)
// and a lenient `…Optional` variant that returns `undefined` so the
// caller can render a "section not configured yet" branch.
// ---------------------------------------------------------------------------

function makeStrict<T>(name: string, ctx: React.Context<T | undefined>) {
  return function useStrict(): T {
    const value = useContext(ctx)
    if (value === undefined) {
      throw new Error(
        `${name}: no <BlogSettingsProvider> in scope, or the corresponding settings section hasn't been seeded yet.`,
      )
    }
    return value
  }
}

function makeOptional<T>(ctx: React.Context<T | undefined>) {
  return function useOptional(): T | undefined {
    return useContext(ctx)
  }
}

export const useSiteIdentity = makeStrict('useSiteIdentity', siteIdentity.context)
export const useSiteIdentityOptional = makeOptional(siteIdentity.context)

export const useLocalization = makeStrict('useLocalization', localization.context)
export const useLocalizationOptional = makeOptional(localization.context)

export const useNavigationSettings = makeStrict('useNavigationSettings', navigation.context)
export const useNavigationSettingsOptional = makeOptional(navigation.context)

export const useSocialsSettings = makeStrict('useSocialsSettings', socials.context)
export const useSocialsSettingsOptional = makeOptional(socials.context)

export const useContentSettings = makeStrict('useContentSettings', content.context)
export const useContentSettingsOptional = makeOptional(content.context)

export const useSidebarSettings = makeStrict('useSidebarSettings', sidebar.context)
export const useSidebarSettingsOptional = makeOptional(sidebar.context)

export const useCommentsSettings = makeStrict('useCommentsSettings', comments.context)
export const useCommentsSettingsOptional = makeOptional(comments.context)

export const useSeoSettings = makeStrict('useSeoSettings', seo.context)
export const useSeoSettingsOptional = makeOptional(seo.context)

export const useFooterSettings = makeStrict('useFooterSettings', footer.context)
export const useFooterSettingsOptional = makeOptional(footer.context)

export const useMailSettings = makeStrict('useMailSettings', mail.context)
export const useMailSettingsOptional = makeOptional(mail.context)

export const useCacheSettings = makeStrict('useCacheSettings', cache.context)
export const useCacheSettingsOptional = makeOptional(cache.context)

/**
 * Aggregate accessor for the whole bundle. Used by the admin shell
 * (which legitimately needs every section in one place) and by the
 * legacy `useRequiredBlogConfig()` wrapper. New UI consumers should
 * NOT reach for this hook — read the section you need instead so your
 * component re-renders only when its section changes.
 */
export function useBlogSettingsBundle(): BlogSettingsBundle | undefined {
  return useContext(BlogSettingsBundleContext)
}
