import type { SocialNetwork } from '@/shared/socials'

// Per-section DTOs for the editable blog configuration.
//
// The runtime config used to live in a single fat aggregated shape;
// it has since been split so that each settings page (general /
// localization / navigation / …) owns an isolated DTO. The DB layer
// stores one row per section (`scope='blog.<section>'`) and
// `BlogSettingsBundle` is the in-memory composition of those rows.
//
// This file is **types-only** by design — the file has no runtime
// surface and zero side effects. The matching runtime module
// (`@/shared/blog-config`) re-exports every type below alongside the
// snapshot slot machinery, so existing import sites keep working
// unchanged. Pure types-only modules can be erased by the bundler
// (per the `bundle-analyzable-paths` rule), which is why the
// per-section React contexts file under `src/ui/lib/` imports
// straight from this file: it doesn't need the snapshot slot at all
// and the smaller import graph keeps the contexts file out of any
// bundle pulled in by the (server-only) snapshot consumers.
//
// Pre-install deployments observe `null` everywhere; the install gate
// catches those requests before any consumer reaches for a section.

// Site identity now also owns the date-formatter inputs (`locale`,
// `timeZone`, `timeFormat`). Folding them into a single section keeps
// `/wp-admin/settings/general` as the one place an operator changes
// "what does the site call itself, in what language" without bouncing
// between two pages.
//
// `locale` is a BCP 47 tag (e.g. `zh-CN`); `timeZone` is an IANA name
// (e.g. `Asia/Shanghai`); `timeFormat` is the project's small token
// language consumed by `formatLocalDate` (`yyyy LL MM dd HH mm`).
export interface SiteIdentitySettings {
  title: string
  description: string
  website: string
  keywords: string[]
  author: { name: string; email: string; url: string }
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
    sortBy: 'publishedAt' | 'updatedAt'
    featureEnabled: boolean
  }
  /**
   * Legacy rows may omit this bucket until the admin saves 「内容与分页」.
   * Runtime renders fall back to 「尾声礼记」 via `@/shared/footnotes-section-title`.
   */
  footnotes?: {
    sectionTitle: string
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
    /** TTL for the temporary comment edit token issued to anonymous commenters (seconds). */
    tokenTtlSeconds: number
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

// Per-bucket Redis cache configuration. Bucket ids are hard-coded
// in the writers — `og` / `calendar` / `avatar` for binary
// generated-image surfaces, plus `image-meta` and `comments-md`
// (the two former `lru-cache` instances now routed through Redis so
// every replica shares warmth). The key PREFIX and TTL are
// runtime-editable so an admin can rename a colliding prefix or
// shorten / lengthen a TTL without redeploying.
export interface CacheSettings {
  cache: {
    og: { prefix: string; ttlSeconds: number }
    calendar: { prefix: string; ttlSeconds: number }
    avatar: { prefix: string; ttlSeconds: number }
    imageMeta: { prefix: string; ttlSeconds: number }
    commentsMd: { prefix: string; ttlSeconds: number }
    embeddingSearch: { prefix: string; ttlSeconds: number }
    searchResult: { prefix: string; ttlSeconds: number }
  }
}

// Merged "存储配置" section: the music CDN host (consumed by
// `<MusicPlayer>` to fetch APlayer audio + lyric metadata from
// `${asset.scheme}://${asset.host}/music/<id>.json`) AND the
// S3-compatible storage credentials AND the upload limits for the
// admin "图片管理" surface. Image public URLs share the same
// `${asset.scheme}://${asset.host}` base with music metadata, so
// keeping both in one section means there's only one place to update
// when the CDN moves.
//
// `storage.enabled` is the master switch:
//   - `false` (default for fresh installs) — uploads are refused at
//     the perimeter; the admin can still browse historical rows and
//     the public render pipeline still resolves their stored URL via
//     `asset.host`. Other S3 fields may be empty strings while the
//     toggle is off so flipping it back on doesn't force the operator
//     to re-enter every field.
//   - `true` — every field below is required (the schema enforces it
//     in `superRefine`). The runtime upload service writes to the
//     configured bucket.
//
// `secretAccessKey` is stored as plaintext just like `mail.apiKey`;
// see the matching admin caveat in the form copy. The form treats an
// empty submitted secret as "keep the existing value" so the admin
// can edit other fields without re-pasting the secret on every save.
export interface AssetsSettings {
  asset: { host: string; scheme: 'http' | 'https' }
  storage: {
    /** Master switch: when `false`, the upload service refuses every request. */
    enabled: boolean
    endpoint: string
    region: string
    bucket: string
    accessKeyId: string
    secretAccessKey: string
    forcePathStyle: boolean
    /**
     * Optional transform template for remote image URLs served by the
     * `asset.host` CDN. Used by the `<Image />` primitive:
     *
     *   - Empty string => passthrough URL (no transform).
     *   - Supports placeholders `{src}`, `{width}`, `{height}`, `{quality}`.
     *   - If `{src}` is omitted, the rendered template is appended to `src`.
     */
    urlTemplate: string
  }
  upload: {
    /** Hard ceiling for an upload after the browser-side JPEG re-encode. */
    maxBytes: number
    /** Default sharp `mozjpeg` quality used by the upload pipeline. */
    jpegQuality: number
  }
}

// Centralised rate-limiting policy. Each bucket is a single
// `(windowSeconds, maxAttempts)` pair the runtime applies to its
// matching surface (login by IP, comment POST by IP / email, like
// increase by IP). Editing the bucket from `/wp-admin/settings/rate-limit`
// takes effect on the next request — the rate-limit module reads the
// fresh slot every call so an admin loosening or tightening the cap
// never has to wait for a TTL or restart.
//
// `windowSeconds` is the rolling Redis EXPIRE TTL; `maxAttempts` is
// the strict upper bound on counter values within that window.
// `count > maxAttempts` returns `exceeded: true`. Setting
// `maxAttempts = 0` would block every attempt; the schema clamps it
// to >= 1 to keep that footgun off the admin form.
export interface RateLimitBucket {
  /** Rolling window for the counter (seconds). */
  windowSeconds: number
  /** Max attempts allowed within the window before the next is rejected. */
  maxAttempts: number
}

export interface RateLimitSettings {
  /** Login attempts per client IP. Counts both successful and failed sign-ins. */
  signInIp: RateLimitBucket
  /** Public comment submissions per client IP. */
  commentPostIp: RateLimitBucket
  /** Public comment submissions per normalised author email (hashed in Redis). */
  commentPostEmail: RateLimitBucket
  /**
   * Like (post / page upvote) increases per client IP. Counters are
   * scoped per IP only — token-based decreases never touch this
   * bucket so an admin can raise the cap without affecting cancel
   * flows.
   */
  likeIncreaseIp: RateLimitBucket
}

export interface SearchSettings {
  search: {
    /** Master switch: when false, search falls back to plain LIKE. */
    enabled: boolean
    /** 'vector' = OpenAI embedding + pgvector; 'like' = Postgres ILIKE on plainText. */
    mode: 'vector' | 'like'
    /** OpenAI-compatible API endpoint. Empty string means use the official OpenAI endpoint. */
    endpoint: string
    /** OpenAI API key. Stored as plaintext like mail.apiKey. */
    apiKey: string
    /** Embedding model. Defaults to text-embedding-3-small (cheap, CJK-friendly). */
    model: string
    /** Cosine similarity threshold (0–1). Only results ≥ this score are returned. */
    similarityThreshold: number
  }
}

// Composed bundle of every section. Each field is `null` until the
// corresponding `setting('blog.<section>')` row has been seeded by the
// install flow or the admin panel. A "fully installed" deployment has
// at least `siteIdentity` and `assets` populated (the install flow
// admin visits the matching `/wp-admin/settings/*` page.
//
// The field set is fixed (twelve buckets, one per `SettingsSection`).
// Adding a thirteenth section is a change to `SETTINGS_SECTIONS` and
// `SECTION_TO_BUNDLE_KEY` in `@/shared/settings.ts` plus extending
// the typed shape below — no sibling `emptyBundle()` / context list
// to also remember.
export interface BlogSettingsBundle {
  siteIdentity: SiteIdentitySettings | null
  assets: AssetsSettings | null
  navigation: NavigationSettings | null
  socials: SocialsSettings | null
  content: ContentSettings | null
  sidebar: SidebarSettings | null
  comments: CommentsSettings | null
  seo: SeoSettings | null
  footer: FooterSettings | null
  mail: MailSettings | null
  cache: CacheSettings | null
  rateLimit: RateLimitSettings | null
  search: SearchSettings | null
}
