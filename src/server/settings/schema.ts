import { z } from 'zod'

import { isSupportedTimeZone } from '@/server/settings/timezones'
import { httpUrlOrEmptyStringSchema } from '@/shared/safe-url'
import { SOCIAL_NETWORK_META, SOCIAL_NETWORKS } from '@/shared/socials'

// Section-scoped Zod schemas mirror the way the admin UI is split: every
// settings page sends only its own slice through `updateSettings`, so the
// validator can stay tightly bounded. The union is reassembled via
// `BlogSettingsPatch` for the storage layer.

export type { SocialNetwork } from '@/shared/socials'
export { SOCIAL_NETWORKS }

const sortOrderSchema = z.enum(['asc', 'desc'])

export const generalSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(240),
  website: z.url(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(20),
  author: z.object({
    name: z.string().trim().min(1).max(60),
    email: z.email(),
    url: z.url(),
  }),
})
export type GeneralInput = z.infer<typeof generalSchema>

// Asset CDN + date-formatting locale. The `asset.host` written here MUST
// match `process.env.ASSET_HOST` at deploy time — the env var feeds the
// build-time MDX compile pipeline, this row feeds runtime consumers
// (SSR + client). The schema rejects an empty hostname so an editor
// can't accidentally point the runtime at a different CDN than the
// committed image-metadata files were generated against.
//
// `locale` is a BCP 47 tag (e.g. `zh-CN`); `timeZone` is an IANA name
// (e.g. `Asia/Shanghai`); `timeFormat` is the project's small token
// language consumed by `formatLocalDate` (`yyyy LL MM dd HH mm`).
export const localizationSchema = z.object({
  asset: z.object({
    host: z
      .string()
      .trim()
      .min(1)
      .max(253)
      .regex(/^[a-z0-9.-]+$/i, '只能包含字母 / 数字 / `-` / `.`'),
    scheme: z.enum(['http', 'https']),
  }),
  locale: z.string().trim().min(2).max(35),
  // The dropdown UI only offers values from `Intl.supportedValuesOf`,
  // but we still validate at the perimeter so a hand-crafted POST that
  // bypasses the picker can't smuggle a bogus zone into the JSONB
  // document — the formatters would silently throw at render time.
  timeZone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isSupportedTimeZone, { message: '必须是 IANA 时区名（如 Asia/Shanghai、UTC）' }),
  timeFormat: z.string().trim().min(1).max(40),
})
export type LocalizationInput = z.infer<typeof localizationSchema>

export const navigationSchema = z.object({
  navigation: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(40),
        link: z.string().trim().min(1).max(200),
        target: z.string().trim().max(20).optional(),
      }),
    )
    .max(20),
})
export type NavigationInput = z.infer<typeof navigationSchema>

// Each row is pinned to a platform from the closed `SOCIAL_NETWORKS`
// list, and the display `type` is forced to the canonical type for that
// platform (WeChat / QQ → qrcode, others → link). The admin form only
// surfaces these as a fixed badge — the schema is the second line of
// defence against a hand-crafted payload that tries to mix and match.
//
// The `superRefine` then enforces uniqueness so every platform appears
// at most once: the editor's "添加社交链接" menu already hides used
// platforms, but a stale tab or a direct API call could otherwise sneak
// duplicates past the UI.
export const socialsSchema = z
  .object({
    socials: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(60),
          network: z.enum(SOCIAL_NETWORKS),
          type: z.enum(['link', 'qrcode']),
          title: z.string().trim().max(120).optional(),
          link: httpUrlOrEmptyStringSchema,
        }),
      )
      .max(SOCIAL_NETWORKS.length),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>()
    value.socials.forEach((row, index) => {
      const expectedType = SOCIAL_NETWORK_META[row.network].type
      if (row.type !== expectedType) {
        ctx.addIssue({
          code: 'custom',
          path: ['socials', index, 'type'],
          message: `「${SOCIAL_NETWORK_META[row.network].label}」固定使用 \`${expectedType}\` 展示方式`,
        })
      }
      if (seen.has(row.network)) {
        ctx.addIssue({
          code: 'custom',
          path: ['socials', index, 'network'],
          message: `「${SOCIAL_NETWORK_META[row.network].label}」已经添加过，请直接编辑已有那条`,
        })
      } else {
        seen.add(row.network)
      }
    })
  })
export type SocialsInput = z.infer<typeof socialsSchema>

export const contentSchema = z.object({
  pagination: z.object({
    posts: z.coerce.number().int().min(1).max(100),
    category: z.coerce.number().int().min(1).max(100),
    tags: z.coerce.number().int().min(1).max(100),
    search: z.coerce.number().int().min(1).max(100),
  }),
  feed: z.object({
    full: z.coerce.boolean(),
    size: z.coerce.number().int().min(1).max(100),
  }),
  post: z.object({
    sort: sortOrderSchema,
    feature: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  }),
})
export type ContentInput = z.infer<typeof contentSchema>

export const sidebarSchema = z.object({
  sidebar: z.object({
    calendar: z.coerce.boolean(),
    search: z.coerce.boolean(),
    comment: z.coerce.number().int().min(0).max(50),
    post: z.coerce.number().int().min(0).max(50),
    tag: z.coerce.number().int().min(0).max(100),
  }),
})
export type SidebarInput = z.infer<typeof sidebarSchema>

export const commentsSchema = z.object({
  comments: z.object({
    size: z.coerce.number().int().min(1).max(100),
    avatar: z.object({
      mirror: z.url(),
      size: z.coerce.number().int().min(16).max(512),
    }),
  }),
})
export type CommentsInput = z.infer<typeof commentsSchema>

export const seoSchema = z.object({
  twitter: z.string().trim().max(60),
  toc: z.object({
    minHeadingLevel: z.coerce.number().int().min(1).max(6),
    maxHeadingLevel: z.coerce.number().int().min(1).max(6),
  }),
  // OG canvas dimensions. The renderer (`@/server/images/og`) reads
  // these at request time, so editing them here takes effect on the next
  // OG image generation. Bound by sensible Twitter/Facebook card limits
  // (Facebook recommends ≥600×315; Twitter caps at 4096×4096).
  og: z.object({
    width: z.coerce.number().int().min(600).max(4096),
    height: z.coerce.number().int().min(315).max(4096),
  }),
})
export type SeoInput = z.infer<typeof seoSchema>

export const footerSchema = z.object({
  footer: z.object({
    initialYear: z.coerce.number().int().min(1970).max(9999),
    icpNo: z.string().trim().max(60).optional(),
    moeIcpNo: z.string().trim().max(60).optional(),
  }),
})
export type FooterInput = z.infer<typeof footerSchema>

// Mail / Zeabur ZSend integration. The host is bounded to a hostname
// (no scheme — the sender hard-codes `https://`), the API key is left
// permissive because Zeabur tokens have no documented format, and the
// sender must be a valid email so the upstream API doesn't 4xx the
// payload before we get any feedback.
//
// `apiKey` is optional so the admin form can save other fields without
// re-pasting the secret on every edit: the perimeter treats `undefined`
// (or omitted) as "keep the existing value" and any string (including
// empty) as a deliberate overwrite. The "always overwrite empty" pivot
// happens in `applySectionPatch`, not here, so the schema stays a pure
// shape validator.
export const mailSchema = z.object({
  mail: z.object({
    enabled: z.coerce.boolean(),
    host: z.string().trim().min(1).max(253),
    apiKey: z.string().trim().max(512).optional(),
    sender: z.union([z.literal(''), z.email()]),
  }),
})
export type MailInput = z.infer<typeof mailSchema>

// Payload for the admin "send test email" button — independent of the
// section-update channel because the action is a side-effect, not a
// document write.
export const sendTestMailSchema = z.object({
  to: z.email(),
})
export type SendTestMailInput = z.infer<typeof sendTestMailSchema>

// Per-bucket Redis cache configuration. Each bucket owns a stable id
// (`og` / `calendar` / `avatar`) baked into the writers; the editor can
// only rename the PREFIX and tune the TTL. The prefix has to end with
// `-` or `:` so the SCAN MATCH `${prefix}*` can never reach into a
// neighbouring bucket's namespace by accident (e.g. an `og` prefix
// could otherwise match `ogre-foo`).
//
// "RESERVED_PREFIXES" enumerates surfaces that the admin panel must
// NEVER let an editor overwrite — the session and rate-limit caches
// both depend on stable key shapes for safety reasons (clearing
// sessions logs everyone out; clearing rate-limit lets bad actors
// retry immediately). `avatar-status` is the historical two-key
// avatar layout — keeping it reserved means a future archeology dig
// can't be silently shadowed.
export const RESERVED_CACHE_PREFIXES: readonly string[] = ['session:', 'rate-limit:', 'avatar-status-']

const PREFIX_PATTERN = /^[a-z0-9_-]+[-:]$/i
// 1 hour ≤ TTL ≤ 30 days. The lower bound keeps a typo from making a
// cache useless (sub-minute TTL would treadmill regenerations and
// hammer Redis); the upper bound keeps stale renders from outliving a
// content rename for too long.
const MIN_TTL_SECONDS = 60 * 60
const MAX_TTL_SECONDS = 60 * 60 * 24 * 30

const cacheBucketSchema = z.object({
  prefix: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(PREFIX_PATTERN, '前缀只能包含字母 / 数字 / `_` / `-`，且必须以 `-` 或 `:` 结尾'),
  ttlSeconds: z.coerce.number().int().min(MIN_TTL_SECONDS).max(MAX_TTL_SECONDS),
})

export const cacheSchema = z
  .object({
    cache: z.object({
      og: cacheBucketSchema,
      calendar: cacheBucketSchema,
      avatar: cacheBucketSchema,
    }),
  })
  .superRefine((value, ctx) => {
    const buckets = value.cache
    const entries: { id: 'og' | 'calendar' | 'avatar'; prefix: string }[] = [
      { id: 'og', prefix: buckets.og.prefix },
      { id: 'calendar', prefix: buckets.calendar.prefix },
      { id: 'avatar', prefix: buckets.avatar.prefix },
    ]

    // Two prefixes "collide" if either is a strict prefix of the other.
    // Equality is the obvious case; the prefix-of case matters because
    // SCAN `og-*` would match keys written under prefix `og-foo-`.
    function collides(a: string, b: string): boolean {
      return a === b || a.startsWith(b) || b.startsWith(a)
    }

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const left = entries[i]
        const right = entries[j]
        if (left === undefined || right === undefined) continue
        if (collides(left.prefix, right.prefix)) {
          ctx.addIssue({
            code: 'custom',
            path: ['cache', right.id, 'prefix'],
            message: `「${right.id}」的前缀 \`${right.prefix}\` 与「${left.id}」的前缀 \`${left.prefix}\` 冲突，会让 SCAN 互相误伤`,
          })
        }
      }

      const reserved = RESERVED_CACHE_PREFIXES.find((slot) => {
        const entry = entries[i]
        if (entry === undefined) return false
        return collides(entry.prefix, slot)
      })
      if (reserved !== undefined) {
        const entry = entries[i]
        if (entry !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['cache', entry.id, 'prefix'],
            message: `\`${entry.prefix}\` 与系统保留前缀 \`${reserved}\` 冲突（session / rate-limit 等不可被管理面板清空）`,
          })
        }
      }
    }
  })
export type CacheSettingsInput = z.infer<typeof cacheSchema>

// The section discriminator (`SETTINGS_SECTIONS`), per-section schema
// map (`SECTION_REGISTRY`), and admin PATCH envelope
// (`updateSettingsSchema`) all live in `@/server/settings/sections.ts`
// so the section name → DB scope → Zod schema → bundle key
// relationship is encoded in a single registry. This module owns only
// the per-section Zod schemas above plus side-effect schemas
// (`sendTestMailSchema`).
