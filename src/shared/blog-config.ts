import type { SocialNetwork } from './socials.ts'

// Per-section DTOs for the editable blog configuration.
//
// The runtime config used to live in a single fat `BlogSettings` shape;
// it has since been split so that each settings page (general /
// localization / navigation / …) owns an isolated DTO. The DB layer
// stores one row per section (`scope='blog.<section>'`) and
// `BlogSettingsBundle` is the in-memory composition of those rows.
//
// Lives in `@/shared/` because:
//   - The client bundle reaches the live values through fine-grained
//     React contexts whose typed shapes are these DTOs.
//   - The server snapshot (`@/shared/blog-config-snapshot`) returns the
//     same bundle so SSR and the client see identical structure.
//
// Pre-install deployments observe `null` everywhere; the install gate
// catches those requests before any consumer reaches for a section.

export interface SiteIdentitySettings {
  title: string
  description: string
  website: string
  keywords: string[]
  author: { name: string; email: string; url: string }
}

// Asset host / scheme. The build-time MDX compile pipeline and the
// `sync-image-metadata` CLI read these out of `process.env.ASSET_HOST` /
// `process.env.ASSET_SCHEME` directly because they run before any DB
// connection exists. The runtime (SSR + client) reads the DB-backed
// values here. The two layers MUST stay in sync at deploy time.
//
// `locale` is a BCP 47 tag (e.g. `zh-CN`); `timeZone` is an IANA name
// (e.g. `Asia/Shanghai`); `timeFormat` is the project's small token
// language consumed by `formatLocalDate` (`yyyy LL MM dd HH mm`).
export interface LocalizationSettings {
  asset: { host: string; scheme: 'http' | 'https' }
  locale: string
  timeZone: string
  timeFormat: string
}

export interface NavigationItem {
  text: string
  link: string
  target?: string
}

export interface NavigationSettings {
  navigation: NavigationItem[]
}

export interface SocialItem {
  name: string
  network: SocialNetwork
  type: 'link' | 'qrcode'
  title?: string
  link: string
}

export interface SocialsSettings {
  socials: SocialItem[]
}

export interface ContentSettings {
  pagination: {
    posts: number
    category: number
    tags: number
    search: number
  }
  feed: {
    full: boolean
    size: number
  }
  post: {
    sort: 'asc' | 'desc'
    feature?: string[]
  }
}

export interface SidebarSettings {
  sidebar: {
    calendar: boolean
    search: boolean
    /** Number of recent / pending comments shown in the sidebar widget. */
    comment: number
    /** Random-pick window for the sidebar's recommended posts widget. */
    post: number
    /** Random-pick window for the sidebar's tag cloud widget. */
    tag: number
  }
}

export interface CommentsSettings {
  comments: {
    /** Page size for the inline comment thread (used on both client and server). */
    size: number
    avatar: {
      mirror: string
      size: number
    }
  }
}

export interface SeoSettings {
  twitter: string
  toc: {
    minHeadingLevel: number
    maxHeadingLevel: number
  }
  og: {
    width: number
    height: number
  }
}

export interface FooterSettings {
  footer: {
    initialYear: number
    icpNo?: string
    moeIcpNo?: string
  }
}

// Outbound mail (Zeabur ZSend) configuration. The `apiKey` field is
// stored as plaintext — see the admin Mail page for the operational
// caveats around DB backups.
export interface MailSettings {
  mail: {
    enabled: boolean
    host: string
    apiKey: string
    sender: string
  }
}

// Per-bucket Redis cache configuration. The bucket id (`og` /
// `calendar` / `avatar`) is hard-coded in the writers, but the key
// PREFIX and TTL are runtime-editable so an admin can rename a
// colliding prefix or shorten / lengthen a TTL without redeploying.
export interface CacheSettings {
  cache: {
    og: { prefix: string; ttlSeconds: number }
    calendar: { prefix: string; ttlSeconds: number }
    avatar: { prefix: string; ttlSeconds: number }
  }
}

// Composed bundle of every section. Each field is `null` until the
// corresponding `setting('blog.<section>')` row has been seeded by the
// install flow or the admin panel. A "fully installed" deployment has
// at least `siteIdentity` and `localization` populated (the install
// flow seeds those two stage-2); other sections may be `null` until
// the admin visits the matching `/wp-admin/settings/*` page.
export interface BlogSettingsBundle {
  siteIdentity: SiteIdentitySettings | null
  localization: LocalizationSettings | null
  navigation: NavigationSettings | null
  socials: SocialsSettings | null
  content: ContentSettings | null
  sidebar: SidebarSettings | null
  comments: CommentsSettings | null
  seo: SeoSettings | null
  footer: FooterSettings | null
  mail: MailSettings | null
  cache: CacheSettings | null
}

// Legacy aggregated view. `BlogSettings` is the historical shape that
// SSR helpers (`requireBlogConfig()`, `getBlogConfigSync()`) and the
// admin layout still consume. New code should prefer the per-section
// DTOs above; this alias is kept so existing call sites can be
// migrated incrementally.
export interface BlogSettings {
  title: string
  description: string
  website: string
  keywords: string[]
  author: { name: string; email: string; url: string }
  navigation: NavigationItem[]
  socials: SocialItem[]
  settings: {
    asset: { host: string; scheme: 'http' | 'https' }
    locale: string
    timeZone: string
    timeFormat: string
    twitter: string
    pagination: ContentSettings['pagination']
    feed: ContentSettings['feed']
    post: ContentSettings['post']
    sidebar: SidebarSettings['sidebar']
    comments: CommentsSettings['comments']
    toc: SeoSettings['toc']
    og: SeoSettings['og']
    footer: FooterSettings['footer']
    mail: MailSettings['mail']
    cache: CacheSettings['cache']
  }
}

// `BlogConfig` is the shape consumers historically reached for through
// the (now-deleted) static `blog.config` shim. It is a 1:1 alias of
// `BlogSettings` because every field is editable at runtime.
export type BlogConfig = BlogSettings

/**
 * Decompose a legacy `BlogSettings` literal into a `BlogSettingsBundle`.
 * Used by tests / fixtures that still spell their fixtures in the
 * aggregated shape so they don't have to be rewritten en masse.
 *
 * Every section is materialised (no `null` buckets) because the input
 * is guaranteed to be a fully-populated `BlogSettings`.
 */
export function blogSettingsToBundle(settings: BlogSettings): BlogSettingsBundle {
  return {
    siteIdentity: {
      title: settings.title,
      description: settings.description,
      website: settings.website,
      keywords: settings.keywords,
      author: settings.author,
    },
    localization: {
      asset: settings.settings.asset,
      locale: settings.settings.locale,
      timeZone: settings.settings.timeZone,
      timeFormat: settings.settings.timeFormat,
    },
    navigation: { navigation: settings.navigation },
    socials: { socials: settings.socials },
    content: {
      pagination: settings.settings.pagination,
      feed: settings.settings.feed,
      post: settings.settings.post,
    },
    sidebar: { sidebar: settings.settings.sidebar },
    comments: { comments: settings.settings.comments },
    seo: {
      twitter: settings.settings.twitter,
      toc: settings.settings.toc,
      og: settings.settings.og,
    },
    footer: { footer: settings.settings.footer },
    mail: { mail: settings.settings.mail },
    cache: { cache: settings.settings.cache },
  }
}

/**
 * Stitch a `BlogSettingsBundle` together into the legacy aggregated
 * `BlogSettings` shape. Returns `null` when either of the two install-
 * required sections (`siteIdentity` + `localization`) is missing — the
 * legacy view has non-optional fields for both, so a half-installed
 * bundle cannot be projected losslessly.
 *
 * Sections that haven't been written yet fall back to empty / sentinel
 * values so the legacy SSR helpers keep working until they're migrated
 * to read the bundle directly. New consumers should NOT depend on
 * those defaults — they exist only to keep the type non-optional.
 */
export function bundleToBlogSettings(bundle: BlogSettingsBundle | null): BlogSettings | null {
  if (bundle === null) return null
  const { siteIdentity, localization } = bundle
  if (siteIdentity === null || localization === null) return null

  return {
    title: siteIdentity.title,
    description: siteIdentity.description,
    website: siteIdentity.website,
    keywords: siteIdentity.keywords,
    author: siteIdentity.author,
    navigation: bundle.navigation?.navigation ?? [],
    socials: bundle.socials?.socials ?? [],
    settings: {
      asset: localization.asset,
      locale: localization.locale,
      timeZone: localization.timeZone,
      timeFormat: localization.timeFormat,
      twitter: bundle.seo?.twitter ?? '',
      pagination: bundle.content?.pagination ?? { posts: 0, category: 0, tags: 0, search: 0 },
      feed: bundle.content?.feed ?? { full: false, size: 0 },
      post: bundle.content?.post ?? { sort: 'desc' },
      sidebar: bundle.sidebar?.sidebar ?? { calendar: false, search: false, comment: 0, post: 0, tag: 0 },
      comments: bundle.comments?.comments ?? { size: 0, avatar: { mirror: '', size: 0 } },
      toc: bundle.seo?.toc ?? { minHeadingLevel: 2, maxHeadingLevel: 4 },
      og: bundle.seo?.og ?? { width: 1200, height: 630 },
      footer: bundle.footer?.footer ?? { initialYear: new Date().getFullYear() },
      mail: bundle.mail?.mail ?? { enabled: false, host: '', apiKey: '', sender: '' },
      cache: bundle.cache?.cache ?? {
        og: { prefix: 'og:', ttlSeconds: 60 * 60 * 24 },
        calendar: { prefix: 'calendar:', ttlSeconds: 60 * 60 * 24 },
        avatar: { prefix: 'avatar:', ttlSeconds: 60 * 60 * 24 },
      },
    },
  }
}
