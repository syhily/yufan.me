import type { ContentRow, PageMetaRow } from '@/server/db/types'
import type { PortableTextBody } from '@/shared/portable-text'

import { prerenderPortableTextBody } from '@/server/cms/pages/prerender'
import {
  toAdminPageDto,
  toAdminRevisionDto,
  toCmsPage,
  type AdminPageDetailDto,
  type AdminPageDto,
  type AdminRevisionDto,
  type CmsPage,
} from '@/server/cms/pages/projection'
import {
  countPageMetas,
  findContentById,
  findLatestDraft,
  findLatestRevision,
  findPageMetaById,
  findPageMetaBySlug,
  findPublicPageMetaBySlug,
  insertPageMeta,
  listPageMetas,
  listPublicPageMetas,
  listRevisions,
  publishLatestRevision,
  restorePageMeta,
  saveDraftRevision,
  softDeletePageMeta,
  updatePageMetaById,
  type ListPagesFilters,
  type PublishLatestResult,
  type SaveDraftResult,
} from '@/server/cms/pages/repository'
import { getLogger } from '@/server/logger'
import { ActionFailure } from '@/server/route-helpers/api-handler'
import { collectHeadings, collectImageStoragePaths, validatePortableTextBody } from '@/shared/portable-text'

// Audit logger for force-overwrite saves. Emits at info level so
// admin actions stay visible in production without being noisy in
// dev. Fields:
//   - actor (admin user id, L2)
//   - pageMetaId (page id, L2)
//   - overwrittenRevisionId (server's latest revision id when the
//     conflict guard was bypassed)
//   - overwrittenRevisionToken (the token the server held just
//     before the overwrite)
//   - clientExpectedToken (what the client thought it was rebasing
//     against — handy for forensics)
//   - mode ('draft' | 'publish')
//   - resultRevisionId (the row that ended up persisted)
const auditLog = getLogger('audit.cms.pages')

// Service layer for the page CMS. Wraps the repository's transactional
// state machines with input validation, ActionFailure surfacing, and
// the projections the API/SSR consumers want.
//
// All public functions in this module either return a DTO ready to
// hand to the wire, or throw `ActionFailure` (translated by `runApi`
// at the route perimeter into the standard error envelope).

// --- Public catalog --------------------------------------------------------

// Visibility gate shared by the listing and single-page lookups.
// A page is considered live publicly iff:
//   1. It hasn't been soft-deleted (the repo lookups already filter
//      this, but we re-check for defence in depth).
//   2. `published === true` (operator hasn't taken it offline).
//   3. `publishedAt <= now()` (i.e. not scheduled for the future).
// Future-dated rows mirror the Fumadocs convention for posts: the
// row is fully promoted, but stays hidden from listings, feeds and
// the detail route until the time arrives.
function isCatalogVisible(meta: PageMetaRow, asOf: Date = new Date()): boolean {
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

/** All non-deleted, non-scheduled, published pages joined with their content. */
export async function loadCatalogPages(): Promise<CmsPage[]> {
  const metas = await listPublicPageMetas()
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
  return visible.map((meta, idx) => toCmsPage(meta, revisions[idx]))
}

/**
 * Single-page lookup for the public detail route. Returns `null` when
 * the slug is unknown, soft-deleted, taken offline, or scheduled for
 * the future. Soft-deleted pages 404; pages with `published=false`
 * on the meta row also 404 — matching the historical Fumadocs
 * `published` frontmatter behaviour. Scheduled (future-dated) pages
 * 404 too so the catalog stays consistent with `loadCatalogPages()`.
 */
export async function loadCatalogPageBySlug(slug: string): Promise<CmsPage | null> {
  const meta = await findPublicPageMetaBySlug(slug)
  if (meta === null || !isCatalogVisible(meta)) {
    return null
  }
  const revision = meta.publishedRevisionId === null ? null : await findContentById(meta.publishedRevisionId)
  return toCmsPage(meta, revision)
}

// --- Admin list / get ------------------------------------------------------

export interface AdminPagesListResult {
  pages: AdminPageDto[]
  total: number
  hasMore: boolean
}

export async function listPagesForAdmin(filters: ListPagesFilters = {}): Promise<AdminPagesListResult> {
  const offset = filters.offset ?? 0
  const [rows, total] = await Promise.all([listPageMetas(filters), countPageMetas(filters)])
  return {
    pages: rows.map(toAdminPageDto),
    total,
    hasMore: offset + rows.length < total,
  }
}

export async function getPageDetailForAdmin(id: bigint): Promise<AdminPageDetailDto | null> {
  const meta = await findPageMetaById(id)
  if (meta === null) {
    return null
  }
  const [latest, published] = await Promise.all([
    findLatestRevision('page', meta.id),
    meta.publishedRevisionId === null ? Promise.resolve(null) : findContentById(meta.publishedRevisionId),
  ])
  return {
    page: toAdminPageDto(meta),
    latestRevision: latest === null ? null : toAdminRevisionDto(latest),
    publishedRevision: published === null ? null : toAdminRevisionDto(published),
  }
}

export async function listRevisionsForAdmin(id: bigint): Promise<AdminRevisionDto[]> {
  const rows = await listRevisions('page', id)
  return rows.map(toAdminRevisionDto)
}

// --- Admin metadata CRUD ---------------------------------------------------

const RESERVED_PAGE_SLUGS = new Set<string>([
  // Reserve slugs that already drive top-level routing on the public
  // site so an admin can't shadow `/posts/...`, `/cats/...`, etc. with
  // a page row.
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

export interface UpsertPageMetaInput {
  /** Existing page id; omitted on create. */
  id?: bigint
  slug: string
  title: string
  summary?: string
  cover?: string
  og?: string | null
  published?: boolean
  commentsEnabled?: boolean
  showToc?: boolean
  publishedAt?: Date
}

function ensureSlugLegal(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    throw new ActionFailure(400, '页面 slug 格式不合法（仅允许小写字母、数字、`-` `_` `.`）。')
  }
  if (slug.length > 80) {
    throw new ActionFailure(400, '页面 slug 长度不得超过 80 个字符。')
  }
  if (RESERVED_PAGE_SLUGS.has(slug)) {
    throw new ActionFailure(400, `slug "${slug}" 是站点保留路径。`)
  }
}

export async function createPage(input: UpsertPageMetaInput, _authorId: bigint | null): Promise<AdminPageDto> {
  ensureSlugLegal(input.slug)
  const collision = await findPageMetaBySlug(input.slug)
  if (collision !== null) {
    throw new ActionFailure(409, `slug "${input.slug}" 已被其它页面占用。`)
  }
  const now = new Date()
  const row = await insertPageMeta({
    slug: input.slug,
    title: input.title,
    summary: input.summary ?? '',
    cover: input.cover ?? '',
    og: input.og ?? null,
    // New pages default to `published = false` — creating + saving
    // is "draft only". The page becomes public when the operator
    // hits "发布" (which both promotes the latest revision *and*
    // flips this flag in the same transaction).
    published: input.published ?? false,
    commentsEnabled: input.commentsEnabled ?? true,
    showToc: input.showToc ?? false,
    publishedAt: input.publishedAt ?? now,
  })
  return toAdminPageDto(row)
}

export async function updatePageMeta(input: UpsertPageMetaInput): Promise<AdminPageDto> {
  if (input.id === undefined) {
    throw new ActionFailure(400, 'updatePageMeta requires an id')
  }
  ensureSlugLegal(input.slug)
  const existing = await findPageMetaById(input.id)
  if (existing === null) {
    throw new ActionFailure(404, '页面不存在或已被删除。')
  }
  if (existing.slug !== input.slug) {
    const collision = await findPageMetaBySlug(input.slug)
    if (collision !== null && collision.id !== input.id) {
      throw new ActionFailure(409, `slug "${input.slug}" 已被其它页面占用。`)
    }
  }
  const updated = await updatePageMetaById(input.id, {
    slug: input.slug,
    title: input.title,
    summary: input.summary ?? existing.summary,
    cover: input.cover ?? existing.cover,
    og: input.og === undefined ? existing.og : input.og,
    published: input.published ?? existing.published,
    commentsEnabled: input.commentsEnabled ?? existing.commentsEnabled,
    showToc: input.showToc ?? existing.showToc,
    publishedAt: input.publishedAt ?? existing.publishedAt,
  })
  if (updated === null) {
    throw new ActionFailure(404, '页面不存在或已被删除。')
  }
  return toAdminPageDto(updated)
}

export async function deletePage(id: bigint): Promise<{ deleted: boolean }> {
  return { deleted: await softDeletePageMeta(id) }
}

export async function restorePage(id: bigint): Promise<{ restored: boolean }> {
  return { restored: await restorePageMeta(id) }
}

// Take a previously published page offline. Flips `meta.published`
// to false without touching the `content` row referenced by
// `published_revision_id` — the public site simply 404s the page
// while the latest published revision stays in the history. A later
// `publishLatest` re-promotes it.
export async function unpublishPage(id: bigint): Promise<AdminPageDto> {
  const existing = await findPageMetaById(id)
  if (existing === null) {
    throw new ActionFailure(404, '页面不存在或已被删除。')
  }
  const updated = await updatePageMetaById(id, { published: false })
  if (updated === null) {
    throw new ActionFailure(404, '页面不存在或已被删除。')
  }
  return toAdminPageDto(updated)
}

// --- Save / publish --------------------------------------------------------

export interface SavePageBodyInput {
  pageId: bigint
  body: unknown
  /** When provided, must match the latest revision's token. */
  expectedClientRevisionToken?: string | null
  /** When true, ignore token mismatch and overwrite. */
  force?: boolean
  /** Author user id stamped on the saved revision. */
  authorId: bigint | null
  /**
   * Publish target (only honoured by `publishLatest`). Omit for
   * "publish immediately" (server uses `now()`); pass a future
   * `Date` to schedule. The catalog hides scheduled pages until
   * `publishedAt <= now()`.
   */
  publishedAt?: Date
}

export type SavePageResult =
  | { status: 'saved'; revision: AdminRevisionDto }
  | {
      status: 'conflict'
      latest: AdminRevisionDto
      /** Token the editor must echo on the next attempt. */
      expectedToken: string
    }

async function savePageBodyInternal(input: SavePageBodyInput, mode: 'draft' | 'publish'): Promise<SavePageResult> {
  // Ensure the doc row exists before we open a transaction. Doing it
  // upfront produces a friendly 404 instead of a transaction-rollback
  // error on the operator's screen.
  const meta = await findPageMetaById(input.pageId)
  if (meta === null) {
    throw new ActionFailure(404, '页面不存在或已被删除。')
  }
  // Validate body + pre-render heavy blocks (Shiki / MathJax /
  // Mermaid) so SSR public renders stay cheap. The pre-render is
  // best-effort: it mutates the validated body in place, leaving
  // already-rendered fields alone and skipping blocks whose
  // renderer throws so a single bad block doesn't fail the save.
  const body = parseBodyOrThrow(input.body)
  await prerenderPortableTextBody(body)
  const imageSources = collectImageStoragePaths(body)
  const headings = collectHeadings(body)

  // Capture the row that's about to be overwritten when force=true,
  // so we can record an audit trail even though the repo already
  // discarded that information by the time it returns. Best-effort
  // — a failure here doesn't block the save (the audit log is
  // diagnostic, not authoritative).
  const overwriteContext = input.force === true ? await findLatestRevision('page', meta.id).catch(() => null) : null

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
      ? await saveDraftRevision(repoInput)
      : // Publish path: pass through the optional `publishedAt`. The
        // repo defaults to `now()` when undefined, so omitting it from
        // the wire = "publish immediately".
        await publishLatestRevision({ ...repoInput, publishedAt: input.publishedAt })
  // Repository status is `'saved'` for drafts and `'published'` for
  // publishes — both indicate a successful write that the audit
  // trail should observe.
  const wroteSuccessfully = result.status === 'saved' || result.status === 'published'
  if (input.force === true && wroteSuccessfully && overwriteContext !== null) {
    // We only emit when an overwrite was actually consequential —
    // i.e. the server's stored token differed from what the client
    // expected. Equal tokens with `force=true` is a no-op overwrite
    // (e.g. the user clicked "use local" on a body that hadn't
    // really diverged) and isn't worth a log line.
    if (
      input.expectedClientRevisionToken === undefined ||
      input.expectedClientRevisionToken !== overwriteContext.clientRevisionToken
    ) {
      auditLog.info('force_overwrite_save', {
        mode,
        actor: input.authorId === null ? null : input.authorId.toString(),
        pageMetaId: meta.id.toString(),
        overwrittenRevisionId: overwriteContext.id.toString(),
        overwrittenRevisionToken: overwriteContext.clientRevisionToken,
        clientExpectedToken: input.expectedClientRevisionToken ?? null,
        resultRevisionId: result.row.id.toString(),
      })
    }
  }
  return projectSaveResult(result)
}

export function saveDraft(input: SavePageBodyInput): Promise<SavePageResult> {
  return savePageBodyInternal(input, 'draft')
}

export function publishLatest(input: SavePageBodyInput): Promise<SavePageResult> {
  return savePageBodyInternal(input, 'publish')
}

function parseBodyOrThrow(value: unknown): PortableTextBody {
  try {
    return validatePortableTextBody(value)
  } catch (error) {
    throw new ActionFailure(400, '正文格式不合法。', extractZodIssues(error))
  }
}

function projectSaveResult(result: SaveDraftResult | PublishLatestResult): SavePageResult {
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
  // Zod errors expose `.issues`; everything else surfaces as a single
  // generic message. We deliberately don't expose the raw payload so
  // a malformed save doesn't echo the editor body back to the client
  // (privacy + log noise).
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

export type { AdminPageDetailDto, AdminPageDto, AdminRevisionDto, CmsPage } from '@/server/cms/pages/projection'

// Convenience for the editor "preview" path: fetch + project the
// latest draft, falling back to the published revision when the
// editor is opened without an in-progress draft.
export async function loadEditorBody(id: bigint): Promise<{
  meta: PageMetaRow
  draft: ContentRow | null
  published: ContentRow | null
}> {
  const meta = await findPageMetaById(id)
  if (meta === null) {
    throw new ActionFailure(404, '页面不存在或已被删除。')
  }
  const [draft, published] = await Promise.all([
    findLatestDraft('page', meta.id),
    meta.publishedRevisionId === null ? Promise.resolve(null) : findContentById(meta.publishedRevisionId),
  ])
  return { meta, draft, published }
}
