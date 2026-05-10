import type { PublishLatestResult, SaveDraftResult } from '@/server/cms/pages/repository'
import type { ContentRow, PostMetaRow } from '@/server/db/types'
import type { PortableTextBody } from '@/shared/portable-text'

import { syncLibraryImageBlocks } from '@/server/cms/pages/image-sync'
import { prerenderPortableTextBody } from '@/server/cms/pages/prerender'
import {
  toAdminPostDto,
  toAdminRevisionDto,
  toCmsPost,
  type AdminPostDetailDto,
  type AdminPostDto,
  type AdminRevisionDto,
  type CmsPost,
} from '@/server/cms/posts/projection'
import {
  countPostMetas,
  findContentById,
  findLatestDraft,
  findLatestRevision,
  findPostMetaById,
  findPostMetaBySlug,
  findPublicPostMetaBySlug,
  insertPostMeta,
  listPostMetas,
  listPublicPostMetas,
  listRevisions,
  publishLatestRevision,
  restorePostMeta,
  saveDraftRevision,
  softDeletePostMeta,
  updatePostMetaById,
  type ListPostsFilters,
} from '@/server/cms/posts/repository'
import { seedTagIfMissing } from '@/server/db/query/tag'
import { getLogger } from '@/server/logger'
import { ActionFailure } from '@/server/route-helpers/api-handler'
import { deriveSlug } from '@/server/slug'
import { derivedTagSlug } from '@/server/tags/slug'
import { collectHeadings, collectImageStoragePaths, validatePortableTextBody } from '@/shared/portable-text'

const auditLog = getLogger('audit.cms.posts')

/** Auto-create any tags that don't already exist in the database. */
async function ensureTagsExist(tagNames: string[]): Promise<void> {
  if (tagNames.length === 0) {
    return
  }
  await Promise.all(tagNames.map((name) => seedTagIfMissing({ name, slug: derivedTagSlug(name) })))
}

// --- Public catalog helpers -------------------------------------------------

function isCatalogVisible(meta: PostMetaRow, asOf: Date = new Date()): boolean {
  if (meta.deletedAt !== null) {
    return false
  }
  if (!meta.published) {
    return false
  }
  if (meta.publishedAt.getTime() > asOf.getTime()) {
    return false
  }
  return true
}

export async function loadCatalogPostMetas(): Promise<CmsPost[]> {
  const metas = await listPublicPostMetas()
  const asOf = new Date()
  const visible = metas.filter((meta) => isCatalogVisible(meta, asOf))
  if (visible.length === 0) {
    return []
  }
  const revisions = await Promise.all(
    visible.map((meta) =>
      meta.publishedRevisionId === null ? Promise.resolve(null) : findContentById(meta.publishedRevisionId),
    ),
  )
  return visible.map((meta, idx) => toCmsPost(meta, revisions[idx]))
}

export async function loadCatalogPostBySlug(slug: string): Promise<CmsPost | null> {
  const meta = await findPublicPostMetaBySlug(slug)
  if (meta === null || !isCatalogVisible(meta)) {
    return null
  }
  const revision = meta.publishedRevisionId === null ? null : await findContentById(meta.publishedRevisionId)
  return toCmsPost(meta, revision)
}

// --- Draft preview ----------------------------------------------------------

export interface PostDraftPreview {
  post: CmsPost
  hasNewerDraft: boolean
}

export async function loadPostDraftPreviewBySlug(slug: string): Promise<PostDraftPreview | null> {
  const meta = await findPublicPostMetaBySlug(slug)
  if (meta === null) {
    return null
  }
  const draft = await findLatestDraft('post', meta.id)
  let revision: ContentRow | null = draft
  if (revision === null && meta.publishedRevisionId !== null) {
    revision = await findContentById(meta.publishedRevisionId)
  }
  return { post: toCmsPost(meta, revision), hasNewerDraft: draft !== null }
}

// --- Admin list / get -------------------------------------------------------

export interface AdminPostsListResult {
  posts: AdminPostDto[]
  total: number
  hasMore: boolean
}

export async function listPostsForAdmin(filters: ListPostsFilters = {}): Promise<AdminPostsListResult> {
  const offset = filters.offset ?? 0
  const limit = filters.limit ?? 20
  const [rows, total] = await Promise.all([listPostMetas({ ...filters, limit, offset }), countPostMetas(filters)])
  return {
    posts: rows.map(toAdminPostDto),
    total,
    hasMore: offset + rows.length < total,
  }
}

export async function getPostDetailForAdmin(id: bigint): Promise<AdminPostDetailDto | null> {
  const meta = await findPostMetaById(id)
  if (meta === null) {
    return null
  }
  const [latest, published] = await Promise.all([
    findLatestRevision('post', meta.id),
    meta.publishedRevisionId === null ? Promise.resolve(null) : findContentById(meta.publishedRevisionId),
  ])
  return {
    post: toAdminPostDto(meta),
    latestRevision: latest === null ? null : toAdminRevisionDto(latest),
    publishedRevision: published === null ? null : toAdminRevisionDto(published),
  }
}

export async function listRevisionsForAdmin(id: bigint): Promise<AdminRevisionDto[]> {
  const rows = await listRevisions('post', id)
  return rows.map(toAdminRevisionDto)
}

// --- Admin metadata CRUD ----------------------------------------------------

const RESERVED_POST_SLUGS = new Set<string>([
  'posts',
  'cats',
  'tags',
  'archives',
  'search',
  'wp-admin',
  'api',
  'feed',
  'sitemap.xml',
  'robots.txt',
])

const SLUG_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/

export interface UpsertPostMetaInput {
  id?: bigint
  slug?: string
  title: string
  summary?: string
  cover?: string
  og?: string | null
  published?: boolean
  commentsEnabled?: boolean
  showToc?: boolean
  visible?: boolean
  category?: string
  tags?: string[]
  alias?: string[]
  publishedAt?: Date
}

function ensureSlugLegal(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    throw new ActionFailure(400, '文章 slug 格式不合法（仅允许小写字母、数字、`-` `_` `.`）。')
  }
  if (slug.length > 80) {
    throw new ActionFailure(400, '文章 slug 长度不得超过 80 个字符。')
  }
  if (RESERVED_POST_SLUGS.has(slug)) {
    throw new ActionFailure(400, `slug "${slug}" 是站点保留路径。`)
  }
}

function resolveSlugForPost(explicit: string | undefined, title: string): string {
  if (typeof explicit === 'string' && explicit.trim() !== '') {
    return explicit.trim()
  }
  const derived = deriveSlug(title)
  if (derived === '') {
    throw new ActionFailure(400, '无法从标题推导出 slug，请手动填写。', [
      { message: '标题推导出空 slug，请手动填写', path: ['slug'] },
    ])
  }
  return derived
}

export async function createPost(input: UpsertPostMetaInput, authorId: bigint | null): Promise<AdminPostDto> {
  const slug = resolveSlugForPost(input.slug, input.title)
  ensureSlugLegal(slug)
  const collision = await findPostMetaBySlug(slug)
  if (collision !== null) {
    throw new ActionFailure(409, `slug "${slug}" 已被其它文章占用。`)
  }
  await ensureTagsExist(input.tags ?? [])
  const now = new Date()
  const row = await insertPostMeta({
    slug,
    title: input.title,
    summary: input.summary ?? '',
    cover: input.cover ?? '',
    og: input.og ?? null,
    published: input.published ?? false,
    commentsEnabled: input.commentsEnabled ?? true,
    showToc: input.showToc ?? false,
    visible: input.visible ?? true,
    category: input.category ?? '',
    tags: input.tags ?? [],
    alias: input.alias ?? [],
    publishedAt: input.publishedAt ?? now,
    authorId,
  })
  return toAdminPostDto(row)
}

export async function updatePostMeta(input: UpsertPostMetaInput): Promise<AdminPostDto> {
  if (input.id === undefined) {
    throw new ActionFailure(400, 'updatePostMeta requires an id')
  }
  const slug = resolveSlugForPost(input.slug, input.title)
  ensureSlugLegal(slug)
  const existing = await findPostMetaById(input.id)
  if (existing === null) {
    throw new ActionFailure(404, '文章不存在或已被删除。')
  }
  if (existing.slug !== slug) {
    const collision = await findPostMetaBySlug(slug)
    if (collision !== null && collision.id !== input.id) {
      throw new ActionFailure(409, `slug "${slug}" 已被其它文章占用。`)
    }
  }
  await ensureTagsExist(input.tags ?? [])
  const updated = await updatePostMetaById(input.id, {
    slug,
    title: input.title,
    summary: input.summary ?? existing.summary,
    cover: input.cover ?? existing.cover,
    og: input.og === undefined ? existing.og : input.og,
    published: input.published ?? existing.published,
    commentsEnabled: input.commentsEnabled ?? existing.commentsEnabled,
    showToc: input.showToc ?? existing.showToc,
    visible: input.visible ?? existing.visible,
    category: input.category ?? existing.category,
    tags: input.tags ?? existing.tags,
    alias: input.alias ?? existing.alias,
    publishedAt: input.publishedAt ?? existing.publishedAt,
  })
  if (updated === null) {
    throw new ActionFailure(404, '文章不存在或已被删除。')
  }
  return toAdminPostDto(updated)
}

export async function deletePost(id: bigint): Promise<{ deleted: boolean }> {
  return { deleted: await softDeletePostMeta(id) }
}

export async function restorePost(id: bigint): Promise<{ restored: boolean }> {
  return { restored: await restorePostMeta(id) }
}

export async function unpublishPost(id: bigint): Promise<AdminPostDto> {
  const existing = await findPostMetaById(id)
  if (existing === null) {
    throw new ActionFailure(404, '文章不存在或已被删除。')
  }
  const updated = await updatePostMetaById(id, { published: false })
  if (updated === null) {
    throw new ActionFailure(404, '文章不存在或已被删除。')
  }
  return toAdminPostDto(updated)
}

// --- Save / publish ---------------------------------------------------------

export interface SavePostBodyInput {
  postId: bigint
  body: unknown
  expectedClientRevisionToken?: string | null
  force?: boolean
  authorId: bigint | null
  publishedAt?: Date
}

export type SavePostResult =
  | { status: 'saved'; revision: AdminRevisionDto }
  | {
      status: 'conflict'
      latest: AdminRevisionDto
      expectedToken: string
    }

async function savePostBodyInternal(input: SavePostBodyInput, mode: 'draft' | 'publish'): Promise<SavePostResult> {
  const meta = await findPostMetaById(input.postId)
  if (meta === null) {
    throw new ActionFailure(404, '文章不存在或已被删除。')
  }
  const body = parseBodyOrThrow(input.body)
  await prerenderPortableTextBody(body)
  await syncLibraryImageBlocks(body).catch(() => undefined)
  const imageSources = collectImageStoragePaths(body)
  const headings = collectHeadings(body, deriveSlug)

  const overwriteContext = input.force === true ? await findLatestRevision('post', meta.id).catch(() => null) : null

  const repoInput = {
    ownerId: meta.id,
    body,
    imageSources,
    headings,
    authorId: input.authorId,
    expectedClientRevisionToken: input.expectedClientRevisionToken,
    force: input.force,
  }

  const result =
    mode === 'draft'
      ? await saveDraftRevision('post', repoInput)
      : await publishLatestRevision('post', { ...repoInput, publishedAt: input.publishedAt })

  const wroteSuccessfully = result.status === 'saved' || result.status === 'published'
  if (input.force === true && wroteSuccessfully && overwriteContext !== null) {
    if (
      input.expectedClientRevisionToken === undefined ||
      input.expectedClientRevisionToken !== overwriteContext.clientRevisionToken
    ) {
      auditLog.info('force_overwrite_save', {
        mode,
        actor: input.authorId === null ? null : input.authorId.toString(),
        postMetaId: meta.id.toString(),
        overwrittenRevisionId: overwriteContext.id.toString(),
        overwrittenRevisionToken: overwriteContext.clientRevisionToken,
        clientExpectedToken: input.expectedClientRevisionToken ?? null,
        resultRevisionId: result.row.id.toString(),
      })
    }
  }
  return projectSaveResult(result)
}

export function saveDraft(input: SavePostBodyInput): Promise<SavePostResult> {
  return savePostBodyInternal(input, 'draft')
}

export function publishLatest(input: SavePostBodyInput): Promise<SavePostResult> {
  return savePostBodyInternal(input, 'publish')
}

function parseBodyOrThrow(value: unknown): PortableTextBody {
  try {
    return validatePortableTextBody(value)
  } catch (error) {
    throw new ActionFailure(400, '正文格式不合法。', extractZodIssues(error))
  }
}

function projectSaveResult(result: SaveDraftResult | PublishLatestResult): SavePostResult {
  if (result.status === 'conflict') {
    return {
      status: 'conflict',
      latest: toAdminRevisionDto(result.latest),
      expectedToken: result.expectedToken,
    }
  }
  return { status: 'saved', revision: toAdminRevisionDto(result.row) }
}

function extractZodIssues(error: unknown): { message: string; path?: string[] }[] | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }
  const issues = (error as { issues?: unknown }).issues
  if (!Array.isArray(issues)) {
    return undefined
  }
  return issues
    .filter((issue): issue is { message: string; path?: unknown[] } => typeof issue === 'object' && issue !== null)
    .map((issue) => ({
      message: typeof issue.message === 'string' ? issue.message : 'invalid body',
      path: Array.isArray(issue.path) ? issue.path.map(String) : undefined,
    }))
}

// --- Re-exports -------------------------------------------------------------

export type { AdminPostDetailDto, AdminPostDto, AdminRevisionDto, CmsPost } from '@/server/cms/posts/projection'

export async function loadEditorBody(id: bigint): Promise<{
  meta: PostMetaRow
  draft: ContentRow | null
  published: ContentRow | null
}> {
  const meta = await findPostMetaById(id)
  if (meta === null) {
    throw new ActionFailure(404, '文章不存在或已被删除。')
  }
  const [draft, published] = await Promise.all([
    findLatestDraft('post', meta.id),
    meta.publishedRevisionId === null ? Promise.resolve(null) : findContentById(meta.publishedRevisionId),
  ])
  return { meta, draft, published }
}
