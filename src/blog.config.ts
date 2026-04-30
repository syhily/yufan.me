// Relative imports so this module stays resolvable from
// `rehype-image-enhance.ts` (and the metadata-store CLI) when Vite
// loads `source.config.ts` before `@/` aliases exist — see the comment
// on `metadata-store.ts` for the same constraint.
import { BLOG_CONSTANTS, type BlogConstants, type BlogSettings, DEFAULT_SETTINGS } from './shared/blog-defaults.ts'
import { SOCIAL_NETWORKS, type SocialNetwork } from './shared/socials.ts'

// Branded social entries in `socials`; Header maps each value to a fixed
// icon. The canonical list lives in `@/shared/socials` so the admin UI
// editor and the Zod schema can both read it without the UI tree
// pulling from `@/server/`.
export { SOCIAL_NETWORKS, type SocialNetwork }

// `BlogConfig` historically described the static configuration object
// every layer imported. After the migration to a DB-backed editable
// settings table, the runtime "live" shape is assembled by
// `getBlogConfigSync()` in `@/server/settings/snapshot` from
// `DEFAULT_SETTINGS` (or DB overlays) merged with `BLOG_CONSTANTS`.
//
// This module keeps a static `BlogConfig` object that mirrors the seed
// values purely for two purposes:
//   1. The default fallback inside `BlogConfigContext` so UI components
//      rendered outside the provider (Storybook fixtures, isolated
//      tests, the `not-found` shell that may render before the provider
//      mounts) still see a fully populated shape.
//   2. Type-only imports across the tree (`import type { BlogConfig }`),
//      which read the structural type without paying any runtime cost.
//
// All editable values come from `DEFAULT_SETTINGS`; bucket-A values come
// from `BLOG_CONSTANTS`. To change a default, edit
// `@/shared/blog-defaults` (a redeploy is required for that file, but
// admin-editable fields can also be changed through `/wp-admin/settings/*`
// at runtime without one).

export interface BlogConfig {
  title: BlogSettings['title']
  description: BlogSettings['description']
  website: BlogSettings['website']
  keywords: BlogSettings['keywords']
  author: BlogSettings['author']
  navigation: BlogSettings['navigation']
  socials: BlogSettings['socials']
  settings: {
    asset: BlogConstants['asset']
    footer: BlogSettings['settings']['footer']
    locale: BlogConstants['locale']
    timeZone: BlogConstants['timeZone']
    timeFormat: BlogConstants['timeFormat']
    twitter: BlogSettings['settings']['twitter']
    pagination: BlogSettings['settings']['pagination']
    feed: BlogSettings['settings']['feed']
    post: BlogSettings['settings']['post']
    sidebar: BlogSettings['settings']['sidebar']
    comments: BlogSettings['settings']['comments']
    toc: BlogSettings['settings']['toc']
    og: BlogSettings['settings']['og']
  }
}

const config: BlogConfig = {
  title: DEFAULT_SETTINGS.title,
  description: DEFAULT_SETTINGS.description,
  website: DEFAULT_SETTINGS.website,
  keywords: DEFAULT_SETTINGS.keywords,
  author: DEFAULT_SETTINGS.author,
  navigation: DEFAULT_SETTINGS.navigation,
  socials: DEFAULT_SETTINGS.socials,
  settings: {
    asset: BLOG_CONSTANTS.asset,
    footer: DEFAULT_SETTINGS.settings.footer,
    locale: BLOG_CONSTANTS.locale,
    timeZone: BLOG_CONSTANTS.timeZone,
    timeFormat: BLOG_CONSTANTS.timeFormat,
    twitter: DEFAULT_SETTINGS.settings.twitter,
    pagination: DEFAULT_SETTINGS.settings.pagination,
    feed: DEFAULT_SETTINGS.settings.feed,
    post: DEFAULT_SETTINGS.settings.post,
    sidebar: DEFAULT_SETTINGS.settings.sidebar,
    comments: DEFAULT_SETTINGS.settings.comments,
    toc: DEFAULT_SETTINGS.settings.toc,
    og: DEFAULT_SETTINGS.settings.og,
  },
}

// Bucket-A asset host/scheme is closed over by the client bundle (see
// `@/client/music`, `@/shared/image-url`, `@/server/images/metadata-store`,
// and the `scripts/sync-image-metadata.ts` CLI). Re-export it as a
// dedicated value so those callers don't have to drill through `config`.
export const assetConfig = config.settings.asset

// Re-export the seed values for callers that historically reached the
// well-known names through `@/blog.config`.
export { BLOG_CONSTANTS, DEFAULT_SETTINGS }

export default config
