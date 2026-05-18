export const SETTINGS_SECTIONS = [
  'general',
  'assets',
  'navigation',
  'socials',
  'content',
  'sidebar',
  'comments',
  'seo',
  'mail',
  'cache',
  'rateLimit',
  'search',
  'fonts',
  'backup',
  'limits',
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

// Section → `BlogSettingsBundle` field mapping. Lives here (and not in
// `@/server/domains/settings/sections.ts`) because every layer of the app
// reaches for it: the server registry uses it to type its `key`
// field, the snapshot builder uses it to project rows into the
// in-memory bundle, and the React contexts file uses it to mint one
// context per bundle slot. Centralising the map deletes three sibling
// "list of 12 keys" copies that used to drift on every section
// addition.
//
// `general` → `siteIdentity` is the only non-identity mapping
// (historical: `blog.general` was renamed before the install seed
// rolled out, but the bundle field kept its old "site identity" name
// so existing UI hooks didn't have to rotate).
export const SECTION_TO_BUNDLE_KEY = {
  general: 'siteIdentity',
  assets: 'assets',
  navigation: 'navigation',
  socials: 'socials',
  content: 'content',
  sidebar: 'sidebar',
  comments: 'comments',
  seo: 'seo',
  mail: 'mail',
  cache: 'cache',
  rateLimit: 'rateLimit',
  search: 'search',
  fonts: 'fonts',
  backup: 'backup',
  limits: 'limits',
} as const satisfies Record<SettingsSection, string>

export type BundleKey = (typeof SECTION_TO_BUNDLE_KEY)[SettingsSection]

/** Stable iteration order for bundle keys (mirrors `SETTINGS_SECTIONS`). */
export const BUNDLE_KEYS = SETTINGS_SECTIONS.map((section) => SECTION_TO_BUNDLE_KEY[section]) as readonly BundleKey[]

// Display metadata for each settings section. The strings are
// rendered in the admin `<SettingsShell>` sidebar and the mobile
// drawer; centralising them here means adding a thirteenth section
// is a one-file edit (extend `SETTINGS_SECTIONS` and add the matching
// label/description) instead of "remember to also touch the sidebar
// component".
//
// Lives in `@/shared/` because the strings are pure data — no
// server- or DOM-only dependencies — and the UI layer must not
// reach into `@/server/` to pull them in.
export interface SectionDisplayMeta {
  /** URL the sidebar `NavLink` points at. */
  to: string
  /** Short Chinese label rendered as the sidebar item title. */
  label: string
  /** One-line Chinese description shown beneath the label. */
  description: string
}

export const SECTION_DISPLAY: Record<SettingsSection, SectionDisplayMeta> = {
  general: {
    to: '/admin/settings/general',
    label: '基本信息',
    description: '站点标题、描述、关键词、作者、语言与时区',
  },
  assets: {
    to: '/admin/settings/assets',
    label: '存储配置',
    description: '资源/CDN 域名、S3 兼容存储、上传参数',
  },
  navigation: { to: '/admin/settings/navigation', label: '导航菜单', description: '顶部导航条目顺序与链接' },
  socials: { to: '/admin/settings/socials', label: '社交链接', description: '社交平台账号与二维码' },
  content: { to: '/admin/settings/content', label: '内容与分页', description: '列表分页大小、排序、Feed' },
  sidebar: { to: '/admin/settings/sidebar', label: '侧边栏', description: '日历、搜索、推荐数量等开关' },
  comments: { to: '/admin/settings/comments', label: '评论与头像', description: '评论分页与 Gravatar 镜像' },
  seo: { to: '/admin/settings/seo', label: 'SEO 与目录', description: 'TOC 标题级别、OG 尺寸' },
  mail: { to: '/admin/settings/mail', label: '邮件服务', description: 'Zeabur ZSend 配置 / 测试发送' },
  cache: { to: '/admin/settings/cache', label: '缓存管理', description: 'OG 图 / 头像 / 日历的 Redis 缓存' },
  rateLimit: {
    to: '/admin/settings/threshold',
    label: '流控设置',
    description: '登录、评论、点赞按 IP / 邮箱的限流策略',
  },
  search: {
    to: '/admin/settings/search',
    label: '文章搜索',
    description: 'AI 向量搜索与关键词搜索切换、OpenAI 配置',
  },
  fonts: {
    to: '/admin/settings/fonts',
    label: '字体配置',
    description: 'OG 图与日历图渲染所用的远程 TTF 字体地址',
  },
  backup: {
    to: '/admin/settings/backup',
    label: '备份与还原',
    description: '数据库自动备份、手动备份与还原',
  },
  limits: {
    to: '/admin/settings/limits',
    label: '运行限制',
    description: '请求体大小限制、会话有效期等运行时阈值',
  },
}

/**
 * Stable display order for the admin settings sidebar (mirrors
 * `SETTINGS_SECTIONS`). Consumed by `<SettingsShell>` so adding a
 * section is a one-file change above plus extending `SETTINGS_SECTIONS`.
 */
export const SECTION_DISPLAY_LIST = SETTINGS_SECTIONS.map((section) => SECTION_DISPLAY[section])

export interface UpdateSettingsInput {
  section: SettingsSection
  payload: unknown
}

// DTO shapes the server projection emits and the admin forms consume. They
// live in shared (not in the admin form modules) so the server projection
// can import them without crossing the server to UI boundary.

export interface AssetsLoaderShape {
  asset: { host: string; scheme: 'http' | 'https' }
  storage: {
    enabled: boolean
    endpoint: string
    region: string
    bucket: string
    accessKeyId: string
    forcePathStyle: boolean
    urlTemplate: string
  }
  /** Last 4 chars of the stored secret access key, or `null` when unset. */
  secretAccessKeyMask: string | null
  upload: { maxBytes: number; jpegQuality: number }
}

export interface SearchLoaderShape {
  search: {
    enabled: boolean
    mode: 'vector' | 'like'
    endpoint: string
    apiKey: string
    model: string
    similarityThreshold: number
  }
  apiKeyMask: string | null
}

export interface UpdateSettingsOutput {
  success: true
}

export interface SendTestMailInput {
  to: string
}

export interface SendTestMailOutput {
  success: true
}
