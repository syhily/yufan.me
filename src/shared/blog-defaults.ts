// Relative import for the same reason as `@/blog.config`: this module
// is reached via the bucket-A bootstrap path during `source.config.ts`
// loading, before `@/` aliases are wired in.
import type { SocialNetwork } from './socials.ts'

// Single isomorphic source of truth for the blog's seed configuration.
// Lives in `@/shared/` because:
//   - The client bundle reaches `BLOG_CONSTANTS.asset` from
//     `@/client/music`, `@/shared/image-url`, and the metadata pipeline.
//   - `@/blog.config.ts` re-exports the same literals as the static
//     fallback used by `BlogConfigContext` when no provider has mounted.
//   - `@/server/settings/defaults.ts` re-exports them so server code can
//     keep importing the well-known names without crossing the
//     server/shared boundary in the wrong direction.
//
// All values are pure literals — no side effects, no environment reads.

// `BlogSettings` is the editable, DB-backed slice of the historical
// `BlogConfig`. It excludes "bucket A" fields — `asset` (closed over by
// the client bundle and the MDX compile pipeline) and
// `locale`/`timeZone`/`timeFormat` (referenced from the shared
// formatter, which sits in the client bundle). Those continue to ship
// code-side as `BLOG_CONSTANTS` and only surface as read-only display
// values in the admin panel.
//
// The OG canvas dimensions used to be bucket-A as well, but the
// renderer (`@/server/images/og`) is server-only and reads the values
// at request time, so they're now editable from `/wp-admin/settings/seo`.
export interface BlogSettings {
  title: string
  description: string
  website: string
  keywords: string[]
  author: { name: string; email: string; url: string }
  navigation: { text: string; link: string; target?: string }[]
  socials: {
    name: string
    network: SocialNetwork
    type: 'link' | 'qrcode'
    title?: string
    link: string
  }[]
  settings: {
    twitter: string
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
    comments: {
      /** Page size for the inline comment thread (used on both client and server). */
      size: number
      avatar: {
        mirror: string
        size: number
      }
    }
    toc: {
      minHeadingLevel: number
      maxHeadingLevel: number
    }
    og: {
      width: number
      height: number
    }
    footer: {
      initialYear: number
      icpNo?: string
      moeIcpNo?: string
    }
    // Outbound mail (Zeabur ZSend) configuration. Used to live in
    // `ZEABUR_MAIL_*` env vars; lifted into the DB so an editor can
    // pause notifications, rotate the API key, or change the From
    // address from the admin panel without redeploying. The `apiKey`
    // field is stored as plaintext — see the admin Mail page for the
    // operational caveats around DB backups.
    mail: {
      enabled: boolean
      host: string
      apiKey: string
      sender: string
    }
    // Per-bucket Redis cache configuration. The bucket ID (`og` /
    // `calendar` / `avatar`) is hard-coded in the writers, but the key
    // PREFIX and TTL are runtime-editable so an admin can rename a
    // colliding prefix or shorten/lengthen a TTL without redeploying.
    //
    // Old keys remain in Redis under their previous prefix until their
    // TTL expires (or until "清空全部缓存" is run); the writers read the
    // live prefix on every request, so a rename takes effect immediately
    // for fresh writes.
    cache: {
      og: { prefix: string; ttlSeconds: number }
      calendar: { prefix: string; ttlSeconds: number }
      avatar: { prefix: string; ttlSeconds: number }
    }
  }
}

// Snapshot of the bucket-A fields that stay code-side. The settings
// panel surfaces these read-only so editors know what would require a
// redeploy.
export interface BlogConstants {
  asset: {
    host: string
    scheme: 'http' | 'https'
  }
  locale: string
  timeZone: string
  timeFormat: string
}

export const BLOG_CONSTANTS: BlogConstants = {
  asset: {
    host: 'cat.yufan.me',
    scheme: 'https',
  },
  locale: 'zh-CN',
  timeZone: 'Asia/Shanghai',
  timeFormat: 'yyyy-MM-dd',
}

export const DEFAULT_SETTINGS: BlogSettings = {
  title: '且听书吟',
  description: '诗与梦想的远方',
  website: 'https://yufan.me',
  keywords: ['雨帆', '且听书吟', 'syhily', 'amehochan', 'yufan'],
  author: {
    name: '雨帆',
    email: 'syhily@gmail.com',
    url: 'https://yufan.me',
  },
  navigation: [
    { text: '首页', link: '/' },
    { text: '分类', link: '/categories' },
    { text: '归档', link: '/archives' },
    { text: '关于', link: '/about' },
    { text: '留言', link: '/guestbook' },
    { text: '友链', link: '/links' },
  ],
  socials: [
    {
      name: 'GitHub',
      network: 'github',
      type: 'link',
      link: 'https://github.com/syhily',
    },
    {
      name: 'Twitter',
      network: 'twitter',
      type: 'link',
      link: 'https://x.com/amehochan',
    },
    {
      name: 'Yufan Sheng',
      network: 'wechat',
      type: 'qrcode',
      title: '扫码加我微信好友',
      link: 'https://u.wechat.com/EBpmuKmrVz4YVFnoCJdnruA',
    },
  ],
  settings: {
    twitter: 'syhily',
    pagination: {
      posts: 6,
      category: 7,
      tags: 7,
      search: 7,
    },
    feed: {
      full: true,
      size: 20,
    },
    post: {
      sort: 'desc',
    },
    sidebar: {
      calendar: true,
      search: true,
      comment: 5,
      post: 5,
      tag: 10,
    },
    comments: {
      size: 10,
      avatar: {
        mirror: 'https://gravatar.loli.net/avatar',
        size: 120,
      },
    },
    toc: {
      minHeadingLevel: 2,
      maxHeadingLevel: 3,
    },
    og: {
      width: 1200,
      height: 768,
    },
    footer: {
      initialYear: 2011,
      icpNo: '皖ICP备2021002315号-2',
    },
    // Mail seeds intentionally leave `apiKey` empty and `enabled: false`
    // — a fresh deployment must opt in from the admin panel rather than
    // accidentally firing notifications with stale credentials. The
    // host / sender literals match what the historical `.env.example`
    // shipped, so a one-liner paste of the API key into the admin form
    // is enough to bring mail back online.
    mail: {
      enabled: false,
      host: 'api.zeabur.com',
      apiKey: '',
      sender: 'noreply@send.yufan.me',
    },
    // Cache prefixes match the historical hard-coded shapes (`og-*`,
    // `calendar-*`, `avatar-*`) so existing keys in Redis remain
    // readable on first deploy; the trailing `-` is the boundary
    // separator. TTLs match the previous constants in the writers
    // (one week / one day / one week).
    cache: {
      og: { prefix: 'og-', ttlSeconds: 60 * 60 * 24 * 7 },
      calendar: { prefix: 'calendar-', ttlSeconds: 60 * 60 * 24 },
      avatar: { prefix: 'avatar-', ttlSeconds: 60 * 60 * 24 * 7 },
    },
  },
}
