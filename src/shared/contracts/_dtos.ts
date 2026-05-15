// Wire DTOs for ts-rest contracts.
//
// This file is the bridge between the TS interfaces in `src/shared/*.ts`
// (the source-of-truth for the wire shape) and the Zod schemas the
// `apiContract` references via `responses`. We deliberately do NOT use
// `z.custom<T>()` here — that would parse-as-passthrough and emit empty
// `{}` in OpenAPI, defeating §3.4 of `hono-api-migration-plan.md`.
//
// Parity invariants: each DTO whose TS interface is already in `shape ==
// wire` form gets a `_<name>Parity` compile-time assertion at the end of
// this file. Drift between the interface and the Zod schema becomes a
// build error.
//
// Exceptions (no parity assertion, documented inline):
//   - `commentItemDto`: server-side `CommentItem` still types `id` as
//     `bigint` and timestamps as `Date`. The wire format requires `string`
//     and ISO-8601. Runtime fix-up belongs in a comment-projection helper
//     and is tracked separately. See `parseComments` in
//     `src/server/comments/loader.ts`.
//   - `blogSettingsBundleDto`: composed of 11 nullable section payloads
//     whose Zod schemas live in `src/server/settings/schema.ts`. Re-using
//     them here would require pulling server-only modules into the
//     contracts tree. We ship a loose passthrough shape per section now;
//     moving section schemas to `src/shared/settings/schemas.ts` is a
//     follow-up.
import { z } from 'zod'

import type {
  AdminCacheStatsDto,
  CacheBucketStats,
  ClearCacheResultDto,
  ReservedCacheBucketStats,
} from '@/shared/cache-types'
import type { AdminCategoryDto } from '@/shared/categories'
import type { AdminPageDetailDto, AdminPageDto, ListPagesOutput } from '@/shared/cms-pages'
import type { AdminPostDetailDto, AdminPostDto, AdminRevisionDto, ListPostsOutput } from '@/shared/cms-posts'
import type { AdminPendingDashboardDto, AdminPendingItemDto } from '@/shared/comments'
import type { AdminFriendDto } from '@/shared/friends'
import type { AdminImageDto, ListImagesOutput } from '@/shared/images'
import type {
  AddMusicOutput,
  AdminMusicDto,
  ListMusicOutput,
  MetingSearchHit,
  PublicMusicMeta,
  SearchMusicOutput,
  UpdateMusicOutput,
} from '@/shared/music'
import type { AdminTagDto } from '@/shared/tags'
import type { AdminUserDto } from '@/shared/users'

import { commentBodySchema } from '@/shared/pt/comment-schema'
import { portableTextBodySchema } from '@/shared/pt/schema'

// ─── parity helpers ────────────────────────────────────
// `Equals<X, Y>` is the standard exact-equality test for TS structural
// types. Combined with `Assert<true>`, it gives a compile-time guarantee
// that a Zod schema's inferred type matches the existing TS interface.
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false
type Assert<T extends true> = T

// ─── primitive wire helpers ────────────────────────────
// `id`-style stringified bigints (decimal digits only).
const idString = z.string().regex(/^\d+$/, 'numeric id required')
// ISO-8601 with timezone, as produced by `Date#toISOString()`.
const isoDateTime = z.iso.datetime()

// ─── markdown / portable-text ──────────────────────────
const markdownHeadingDto = z.object({
  depth: z.number().int().min(1).max(6),
  slug: z.string(),
  text: z.string(),
})

// ─── users ─────────────────────────────────────────────
export const adminUserDto = z.object({
  id: idString,
  name: z.string(),
  email: z.string(),
  link: z.string().nullable(),
  badgeName: z.string().nullable(),
  badgeColor: z.string().nullable(),
  badgeTextColor: z.string().nullable(),
  role: z.enum(['admin', 'author', 'visitor']).nullable(),
  isMuted: z.boolean(),
  emailVerified: z.boolean(),
  createdAt: isoDateTime,
  deletedAt: isoDateTime.nullable(),
  lastIp: z.string().nullable(),
  lastUa: z.string().nullable(),
  commentCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  lastCommentAt: isoDateTime.nullable(),
})

// ─── categories / tags / friends ───────────────────────
export const adminCategoryDto = z.object({
  id: idString,
  name: z.string(),
  slug: z.string(),
  cover: z.string(),
  description: z.string(),
  sortOrder: z.number().int(),
  postCount: z.number().int().nonnegative(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})

export const adminTagDto = z.object({
  id: idString,
  name: z.string(),
  slug: z.string(),
  postCount: z.number().int().nonnegative(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})

export const adminFriendDto = z.object({
  id: idString,
  website: z.string(),
  description: z.string().nullable(),
  homepage: z.string(),
  poster: z.string(),
  rssUrl: z.string().nullable(),
  visible: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})

// ─── images ────────────────────────────────────────────
export const adminImageKind = z.enum(['generic', 'category', 'friend'])

export const adminImageDto = z.object({
  id: idString,
  kind: adminImageKind,
  storagePath: z.string(),
  publicUrl: z.string(),
  mimeType: z.string(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  byteSize: z.number().int().nonnegative(),
  thumbhash: z.string().nullable(),
  uploaderId: idString.nullable(),
  uploaderName: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})

export const listImagesOutputDto = z.object({
  images: z.array(adminImageDto),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
})

// ─── music ─────────────────────────────────────────────
const metingSource = z.enum(['netease'])

export const adminMusicDto = z.object({
  id: idString,
  source: metingSource,
  sourceId: z.string(),
  playerId: z.string(),
  name: z.string(),
  artist: z.array(z.string()),
  album: z.string(),
  audioStoragePath: z.string(),
  audioUrl: z.string(),
  coverStoragePath: z.string(),
  coverUrl: z.string(),
  lyric: z.string().nullable(),
  uploaderId: idString.nullable(),
  uploaderName: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})

export const metingSearchHitDto = z.object({
  source: metingSource,
  sourceId: z.string(),
  name: z.string(),
  artist: z.array(z.string()),
  album: z.string(),
  coverUrl: z.string(),
  previewUrl: z.string(),
})

export const publicMusicMetaDto = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string(),
  album: z.string(),
  url: z.string(),
  pic: z.string(),
  lyric: z.string(),
})

export const listMusicOutputDto = z.object({
  musics: z.array(adminMusicDto),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
})

export const searchMusicOutputDto = z.object({
  results: z.array(metingSearchHitDto),
})

export const addMusicOutputDto = z.object({ music: adminMusicDto })
export const updateMusicOutputDto = z.object({ music: adminMusicDto })

// ─── posts / pages ─────────────────────────────────────
export const adminPostDto = z.object({
  id: idString,
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  cover: z.string(),
  og: z.string().nullable(),
  published: z.boolean(),
  commentsEnabled: z.boolean(),
  showToc: z.boolean(),
  showUpdated: z.boolean(),
  visible: z.boolean(),
  publishedAt: isoDateTime,
  publishedRevisionId: idString.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.nullable(),
  category: z.string(),
  tags: z.array(z.string()),
  alias: z.array(z.string()),
  authorId: idString.nullable(),
  authorName: z.string().nullable(),
  pinnedAt: isoDateTime.nullable(),
  firstPublishedAt: isoDateTime.nullable(),
  commentCount: z.number().int().nonnegative(),
  commentPublicId: z.string(),
})

export const adminPageDto = z.object({
  id: idString,
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  cover: z.string(),
  og: z.string().nullable(),
  published: z.boolean(),
  commentsEnabled: z.boolean(),
  showToc: z.boolean(),
  showUpdated: z.boolean(),
  showFriends: z.boolean(),
  publishedAt: isoDateTime,
  publishedRevisionId: idString.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.nullable(),
  authorId: idString.nullable(),
  authorName: z.string().nullable(),
  commentCount: z.number().int().nonnegative(),
  commentPublicId: z.string(),
})

export const adminRevisionDto = z.object({
  id: idString,
  revisionNo: z.number().int().nonnegative(),
  status: z.enum(['draft', 'published']),
  body: portableTextBodySchema,
  imageSources: z.array(z.string()),
  headings: z.array(markdownHeadingDto),
  authorId: idString.nullable(),
  clientRevisionToken: z.string(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})

export const adminPostDetailDto = z.object({
  post: adminPostDto,
  latestRevision: adminRevisionDto.nullable(),
  publishedRevision: adminRevisionDto.nullable(),
})

export const adminPageDetailDto = z.object({
  page: adminPageDto,
  latestRevision: adminRevisionDto.nullable(),
  publishedRevision: adminRevisionDto.nullable(),
})

export const listPostsOutputDto = z.object({
  posts: z.array(adminPostDto),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
})

export const listPagesOutputDto = z.object({
  pages: z.array(adminPageDto),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
})

export const listPostRevisionsOutputDto = z.object({
  revisions: z.array(adminRevisionDto),
})

export const listPageRevisionsOutputDto = z.object({
  revisions: z.array(adminRevisionDto),
})

// ─── comments ──────────────────────────────────────────
// Wire shape — `id`/`ownerId`/`userId`/`rootId` are strings, dates are
// ISO. The server-side `CommentItem` TS interface still uses
// `bigint`/`Date` because the shape flows directly out of Drizzle. A
// projection step (`toWireCommentItem`) must be added before
// `c.json(...)` for the contract to hold; F2.1 will surface the gap.
const commentBaseDto = z.object({
  id: idString,
  createAt: isoDateTime,
  updatedAt: isoDateTime,
  deleteAt: isoDateTime.nullable(),
  deleteRequestedAt: isoDateTime.nullable().optional(),
  body: commentBodySchema,
  content: z.string().nullable(),
  type: z.enum(['post', 'page']).nullable(),
  ownerId: idString.nullable(),
  userId: idString,
  isVerified: z.boolean().nullable(),
  ua: z.string().nullable(),
  ip: z.string().nullable(),
  rid: z.number().int().nonnegative(),
  isCollapsed: z.boolean().nullable(),
  isPending: z.boolean().nullable(),
  isPinned: z.boolean().nullable(),
  voteUp: z.number().nullable(),
  voteDown: z.number().nullable(),
  rootId: idString.nullable(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  link: z.string().nullable(),
  badgeName: z.string().nullable(),
  badgeColor: z.string().nullable(),
  badgeTextColor: z.string().nullable(),
})

export type CommentItemWire = z.infer<typeof commentBaseDto> & {
  children?: CommentItemWire[]
}

export const commentItemDto: z.ZodType<CommentItemWire> = commentBaseDto.extend({
  children: z.lazy(() => z.array(commentItemDto).optional()),
}) as z.ZodType<CommentItemWire>

export const adminCommentDto = commentBaseDto.extend({
  pageTitle: z.string().nullable(),
  pagePublicId: z.string().nullable(),
})

export type AdminCommentWire = z.infer<typeof adminCommentDto>

export const adminPendingItemDto = z.object({
  id: idString,
  kind: z.enum(['approval', 'deletion']),
  authorName: z.string(),
  authorLink: z.string().nullable(),
  excerpt: z.string(),
  createdAtIso: isoDateTime,
  deleteRequestedAtIso: isoDateTime.nullable(),
  pageTitle: z.string().nullable(),
  pagePermalink: z.string().nullable(),
})

export const adminPendingDashboardDto = z.object({
  items: z.array(adminPendingItemDto),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  counts: z.object({
    all: z.number().int().nonnegative(),
    approval: z.number().int().nonnegative(),
    deletion: z.number().int().nonnegative(),
  }),
})

// ─── cache ─────────────────────────────────────────────
const cacheBucketId = z.enum(['og', 'calendar', 'avatar', 'imageMeta', 'embeddingSearch', 'searchResult'])
const reservedCacheBucketId = z.enum(['session', 'rateLimit'])

const cacheBucketStatsDto = z.object({
  id: cacheBucketId,
  label: z.string(),
  description: z.string(),
  prefix: z.string(),
  ttlSeconds: z.number().int().nonnegative(),
  pattern: z.string(),
  keyCount: z.number().int().nonnegative(),
})

const reservedCacheBucketStatsDto = z.object({
  id: reservedCacheBucketId,
  label: z.string(),
  description: z.string(),
  prefix: z.string(),
  pattern: z.string(),
  keyCount: z.number().int().nonnegative(),
})

export const adminCacheStatsDto = z.object({
  buckets: z.array(cacheBucketStatsDto),
  reserved: z.array(reservedCacheBucketStatsDto),
  total: z.number().int().nonnegative(),
  generatedAt: isoDateTime,
})

export const clearCacheResultDto = z.object({
  cleared: z.array(z.object({ bucketId: cacheBucketId, label: z.string(), removed: z.number().int().nonnegative() })),
  total: z.number().int().nonnegative(),
  refreshedStats: adminCacheStatsDto,
})

// ─── settings ──────────────────────────────────────────
// Loose `z.unknown()` per section until the per-section Zod schemas in
// `src/server/settings/schema.ts` move to `src/shared/`. We deliberately
// avoid `z.object({}).passthrough()` because it injects a
// `[x: string]: unknown` index signature into the inferred type, which
// would make the existing strict `SiteIdentitySettings`-style interfaces
// non-assignable. Tracked in `docs/hono-finalization-plan.md` §0.2 P2.
const sectionPayload = z.unknown().nullable()

export const blogSettingsBundleDto = z.object({
  siteIdentity: sectionPayload,
  assets: sectionPayload,
  navigation: sectionPayload,
  socials: sectionPayload,
  content: sectionPayload,
  sidebar: sectionPayload,
  comments: sectionPayload,
  seo: sectionPayload,
  footer: sectionPayload,
  mail: sectionPayload,
  cache: sectionPayload,
})

// ─── parity assertions ─────────────────────────────────
// If any of these lines errors, the Zod schema has drifted from the TS
// interface. Either update the interface or update the Zod schema —
// they are the same wire contract.

type _adminUserDtoParity = Assert<Equals<z.infer<typeof adminUserDto>, AdminUserDto>>
type _adminCategoryDtoParity = Assert<Equals<z.infer<typeof adminCategoryDto>, AdminCategoryDto>>
type _adminTagDtoParity = Assert<Equals<z.infer<typeof adminTagDto>, AdminTagDto>>
type _adminFriendDtoParity = Assert<Equals<z.infer<typeof adminFriendDto>, AdminFriendDto>>
type _adminImageDtoParity = Assert<Equals<z.infer<typeof adminImageDto>, AdminImageDto>>
type _listImagesParity = Assert<Equals<z.infer<typeof listImagesOutputDto>, ListImagesOutput>>
type _adminMusicDtoParity = Assert<Equals<z.infer<typeof adminMusicDto>, AdminMusicDto>>
type _metingSearchHitParity = Assert<Equals<z.infer<typeof metingSearchHitDto>, MetingSearchHit>>
type _publicMusicMetaParity = Assert<Equals<z.infer<typeof publicMusicMetaDto>, PublicMusicMeta>>
type _listMusicOutputParity = Assert<Equals<z.infer<typeof listMusicOutputDto>, ListMusicOutput>>
type _searchMusicOutputParity = Assert<Equals<z.infer<typeof searchMusicOutputDto>, SearchMusicOutput>>
type _addMusicOutputParity = Assert<Equals<z.infer<typeof addMusicOutputDto>, AddMusicOutput>>
type _updateMusicOutputParity = Assert<Equals<z.infer<typeof updateMusicOutputDto>, UpdateMusicOutput>>
type _adminPostDtoParity = Assert<Equals<z.infer<typeof adminPostDto>, AdminPostDto>>
type _adminPageDtoParity = Assert<Equals<z.infer<typeof adminPageDto>, AdminPageDto>>
type _adminRevisionDtoParity = Assert<Equals<z.infer<typeof adminRevisionDto>, AdminRevisionDto>>
type _adminPostDetailParity = Assert<Equals<z.infer<typeof adminPostDetailDto>, AdminPostDetailDto>>
type _adminPageDetailParity = Assert<Equals<z.infer<typeof adminPageDetailDto>, AdminPageDetailDto>>
type _listPostsOutputParity = Assert<Equals<z.infer<typeof listPostsOutputDto>, ListPostsOutput>>
type _listPagesOutputParity = Assert<Equals<z.infer<typeof listPagesOutputDto>, ListPagesOutput>>
type _adminPendingItemParity = Assert<Equals<z.infer<typeof adminPendingItemDto>, AdminPendingItemDto>>
type _adminPendingDashboardParity = Assert<Equals<z.infer<typeof adminPendingDashboardDto>, AdminPendingDashboardDto>>
type _cacheBucketStatsParity = Assert<Equals<z.infer<typeof cacheBucketStatsDto>, CacheBucketStats>>
type _reservedCacheBucketStatsParity = Assert<
  Equals<z.infer<typeof reservedCacheBucketStatsDto>, ReservedCacheBucketStats>
>
type _adminCacheStatsParity = Assert<Equals<z.infer<typeof adminCacheStatsDto>, AdminCacheStatsDto>>
type _clearCacheResultParity = Assert<Equals<z.infer<typeof clearCacheResultDto>, ClearCacheResultDto>>
