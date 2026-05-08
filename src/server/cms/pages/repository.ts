import { and, desc, eq, isNull, max, sql, type SQL } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import type { ContentRow, NewContent, NewPageMeta, PageMetaRow } from '@/server/db/types'

import { db } from '@/server/db/pool'
// `doc` is the temporary schema-level name for the future `page` table
// (see schema.ts and AGENTS.md). Throughout the CMS service layer we
// import it under the business name `pageMetaTable` so the only line
// that knows about the placeholder lives here.
import { content as contentTable, doc as pageMetaTable } from '@/server/db/schema'

// --- Reads -------------------------------------------------------------------

export interface ListPagesFilters {
  /** Free-text query matched case-insensitively against `slug` and `title`. */
  q?: string
  /** When false (default) soft-deleted rows are excluded. */
  includeDeleted?: boolean
  /** Zero-based offset for pagination. */
  offset?: number
  /** Page size. When undefined every match is returned. */
  limit?: number
}

function buildPagesWhere(filters: ListPagesFilters): SQL | undefined {
  const conditions: SQL[] = []
  if (!filters.includeDeleted) {
    conditions.push(isNull(pageMetaTable.deletedAt))
  }
  if (filters.q && filters.q.trim() !== '') {
    const pattern = `%${filters.q.trim()}%`
    // ILIKE on both columns; the slug + title combo is what admins
    // search by when looking for "guestbook" or "关于我".
    conditions.push(sql`(${pageMetaTable.slug} ILIKE ${pattern} OR ${pageMetaTable.title} ILIKE ${pattern})`)
  }
  if (conditions.length === 0) {
    return undefined
  }
  if (conditions.length === 1) {
    return conditions[0]
  }
  return and(...conditions)
}

export async function listPageMetas(filters: ListPagesFilters = {}): Promise<PageMetaRow[]> {
  const where = buildPagesWhere(filters)
  let q = where
    ? db.select().from(pageMetaTable).where(where).orderBy(desc(pageMetaTable.updatedAt))
    : db.select().from(pageMetaTable).orderBy(desc(pageMetaTable.updatedAt))
  if (filters.limit !== undefined) {
    q = q.limit(filters.limit) as typeof q
  }
  if (filters.offset !== undefined && filters.offset > 0) {
    q = q.offset(filters.offset) as typeof q
  }
  return q
}

export async function countPageMetas(filters: ListPagesFilters = {}): Promise<number> {
  const where = buildPagesWhere(filters)
  const builder = where
    ? db
        .select({ count: sql<number>`count(*)::int` })
        .from(pageMetaTable)
        .where(where)
    : db.select({ count: sql<number>`count(*)::int` }).from(pageMetaTable)
  const rows = await builder
  return rows[0]?.count ?? 0
}

export async function findPageMetaById(id: bigint): Promise<PageMetaRow | null> {
  const rows = await db.select().from(pageMetaTable).where(eq(pageMetaTable.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findPageMetaBySlug(slug: string): Promise<PageMetaRow | null> {
  const rows = await db.select().from(pageMetaTable).where(eq(pageMetaTable.slug, slug)).limit(1)
  return rows[0] ?? null
}

/**
 * Slug-keyed lookup that **excludes** soft-deleted rows. Used by the
 * public catalog where deleted pages should 404 even if they share a
 * slug with a future restoration target.
 */
export async function findPublicPageMetaBySlug(slug: string): Promise<PageMetaRow | null> {
  const rows = await db
    .select()
    .from(pageMetaTable)
    .where(and(eq(pageMetaTable.slug, slug), isNull(pageMetaTable.deletedAt)))
    .limit(1)
  return rows[0] ?? null
}

/** All non-deleted page meta rows; cataloged at startup. */
export async function listPublicPageMetas(): Promise<PageMetaRow[]> {
  return db.select().from(pageMetaTable).where(isNull(pageMetaTable.deletedAt)).orderBy(desc(pageMetaTable.publishedAt))
}

// --- Content (revision) reads -----------------------------------------------

export type ContentType = 'page' | 'post'

export async function findContentById(id: bigint): Promise<ContentRow | null> {
  const rows = await db.select().from(contentTable).where(eq(contentTable.id, id)).limit(1)
  return rows[0] ?? null
}

/**
 * Latest revision (any status) for `(type, ownerId)`. Returns `null`
 * when the owner has no revisions at all (e.g. a freshly created
 * `doc` row before its first save).
 */
export async function findLatestRevision(type: ContentType, ownerId: bigint): Promise<ContentRow | null> {
  const rows = await db
    .select()
    .from(contentTable)
    .where(and(eq(contentTable.type, type), eq(contentTable.ownerId, ownerId)))
    .orderBy(desc(contentTable.revisionNo))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Latest **draft** revision for `(type, ownerId)`. Used by the editor
 * "load draft" path so reopening the editor restores the in-progress
 * revision instead of the published one.
 */
export async function findLatestDraft(type: ContentType, ownerId: bigint): Promise<ContentRow | null> {
  const rows = await db
    .select()
    .from(contentTable)
    .where(and(eq(contentTable.type, type), eq(contentTable.ownerId, ownerId), eq(contentTable.status, 'draft')))
    .orderBy(desc(contentTable.revisionNo))
    .limit(1)
  return rows[0] ?? null
}

/** All revisions for `(type, ownerId)` ordered newest-first. */
export async function listRevisions(type: ContentType, ownerId: bigint): Promise<ContentRow[]> {
  return db
    .select()
    .from(contentTable)
    .where(and(eq(contentTable.type, type), eq(contentTable.ownerId, ownerId)))
    .orderBy(desc(contentTable.revisionNo))
}

// --- Writes ------------------------------------------------------------------

export async function insertPageMeta(values: NewPageMeta): Promise<PageMetaRow> {
  const rows = await db.insert(pageMetaTable).values(values).returning()
  return rows[0]
}

export async function updatePageMetaById(
  id: bigint,
  patch: Partial<Omit<NewPageMeta, 'id' | 'createdAt'>>,
): Promise<PageMetaRow | null> {
  const rows = await db
    .update(pageMetaTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(pageMetaTable.id, id))
    .returning()
  return rows[0] ?? null
}

/**
 * Soft-delete: stamp `deleted_at` so listing routes hide the row but
 * the rows themselves stay around for `restorePage`. Returns false
 * when the row was already deleted (idempotent for the admin button).
 */
export async function softDeletePageMeta(id: bigint): Promise<boolean> {
  const now = new Date()
  const rows = await db
    .update(pageMetaTable)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(pageMetaTable.id, id), isNull(pageMetaTable.deletedAt)))
    .returning({ id: pageMetaTable.id })
  return rows.length > 0
}

export async function restorePageMeta(id: bigint): Promise<boolean> {
  const rows = await db
    .update(pageMetaTable)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(pageMetaTable.id, id))
    .returning({ id: pageMetaTable.id })
  return rows.length > 0
}

// --- Transactional save / publish -------------------------------------------

export interface SaveDraftInput {
  ownerId: bigint
  /** Caller-provided body; pre-validated by `portableTextBodySchema`. */
  body: unknown
  /**
   * Pre-computed image storage paths the body references — denormalised
   * so the SSR thumbhash enhancer stays a single bulk lookup. Also
   * pre-validated upstream.
   */
  imageSources: string[]
  /** Pre-computed TOC headings projection. */
  headings: unknown
  /** Author user id stamped on the saved revision. */
  authorId: bigint | null
  /**
   * Optimistic lock token the client received with the editor state.
   * When provided, the save is rejected unless the latest revision's
   * `client_revision_token` matches. Pass `undefined` to opt out (e.g.
   * the very first save on a freshly created doc with no revisions yet).
   * Pass `null` to allow the save when there's no existing revision.
   */
  expectedClientRevisionToken?: string | null
  /** When true, ignore `expectedClientRevisionToken` mismatch (force save). */
  force?: boolean
}

export type SaveDraftResult =
  | { status: 'saved'; row: ContentRow }
  | { status: 'conflict'; latest: ContentRow; expectedToken: string }

/**
 * Save-draft state machine, transactionally:
 *
 *   - Acquire `FOR UPDATE` lock on the doc row so two concurrent saves
 *     serialise on the same revision number computation.
 *   - Find the latest revision for `(type='page', ownerId)`.
 *   - When that revision is **already published** *or* there is no
 *     revision yet, INSERT a fresh draft with `revision_no = max+1` and
 *     a freshly minted `client_revision_token`.
 *   - When that revision is a draft, optionally verify the client's
 *     `expectedClientRevisionToken` matches; if not, return `conflict`.
 *     Otherwise UPDATE the draft in place (still rotating
 *     `client_revision_token` so the editor's next save passes the
 *     fresh token).
 *
 * The doc row's `updated_at` is bumped so the admin list reflects
 * recent activity.
 */
export async function saveDraftRevision(input: SaveDraftInput): Promise<SaveDraftResult> {
  return db.transaction(async (tx) => {
    // Lock the doc row so concurrent saves can't both compute the same
    // `MAX(revision_no) + 1` and trip `uq_content_owner_revision`.
    const docLockRows = await tx
      .select({ id: pageMetaTable.id })
      .from(pageMetaTable)
      .where(eq(pageMetaTable.id, input.ownerId))
      .for('update')
    if (docLockRows.length === 0) {
      throw new Error(`page meta row ${input.ownerId} not found`)
    }

    const latestRows = await tx
      .select()
      .from(contentTable)
      .where(and(eq(contentTable.type, 'page'), eq(contentTable.ownerId, input.ownerId)))
      .orderBy(desc(contentTable.revisionNo))
      .limit(1)
    const latest = latestRows[0]

    const nextToken = randomUUID()
    const now = new Date()
    const bodyJson = input.body
    const imageSourcesJson = input.imageSources
    const headingsJson = input.headings

    // Path 1: latest is a draft + caller's expected token matches → UPDATE in place.
    if (latest !== undefined && latest.status === 'draft') {
      if (
        !input.force &&
        input.expectedClientRevisionToken !== undefined &&
        input.expectedClientRevisionToken !== latest.clientRevisionToken
      ) {
        return { status: 'conflict' as const, latest, expectedToken: latest.clientRevisionToken }
      }
      const updated = await tx
        .update(contentTable)
        .set({
          updatedAt: now,
          body: bodyJson as ContentRow['body'],
          imageSources: imageSourcesJson as ContentRow['imageSources'],
          headings: headingsJson as ContentRow['headings'],
          authorId: input.authorId ?? latest.authorId,
          clientRevisionToken: nextToken,
        })
        .where(eq(contentTable.id, latest.id))
        .returning()
      await tx.update(pageMetaTable).set({ updatedAt: now }).where(eq(pageMetaTable.id, input.ownerId))
      return { status: 'saved' as const, row: updated[0] }
    }

    // Path 2: latest is published OR no revision yet → INSERT a new draft.
    if (
      !input.force &&
      input.expectedClientRevisionToken !== undefined &&
      latest !== undefined &&
      input.expectedClientRevisionToken !== latest.clientRevisionToken
    ) {
      // The client thought there was a different latest revision; bail
      // before mutating so the UI can surface the conflict diff.
      return { status: 'conflict' as const, latest, expectedToken: latest.clientRevisionToken }
    }

    const nextRevisionNo = (latest?.revisionNo ?? 0) + 1
    const insert: NewContent = {
      type: 'page',
      ownerId: input.ownerId,
      revisionNo: nextRevisionNo,
      status: 'draft',
      body: bodyJson as NewContent['body'],
      imageSources: imageSourcesJson as NewContent['imageSources'],
      headings: headingsJson as NewContent['headings'],
      authorId: input.authorId,
      clientRevisionToken: nextToken,
    }
    const inserted = await tx.insert(contentTable).values(insert).returning()
    await tx.update(pageMetaTable).set({ updatedAt: now }).where(eq(pageMetaTable.id, input.ownerId))
    return { status: 'saved' as const, row: inserted[0] }
  })
}

export interface PublishLatestInput extends SaveDraftInput {}

export type PublishLatestResult =
  | { status: 'published'; row: ContentRow }
  | { status: 'conflict'; latest: ContentRow; expectedToken: string }

/**
 * Publish state machine: save the editor body **then** mark the saved
 * revision as `published` and point `doc.published_revision_id` at it,
 * all in one transaction. The save half follows the same conflict
 * rules as `saveDraftRevision` (token mismatch returns `conflict`
 * unless `force=true`).
 */
export async function publishLatestRevision(input: PublishLatestInput): Promise<PublishLatestResult> {
  return db.transaction(async (tx) => {
    const docLockRows = await tx
      .select({ id: pageMetaTable.id })
      .from(pageMetaTable)
      .where(eq(pageMetaTable.id, input.ownerId))
      .for('update')
    if (docLockRows.length === 0) {
      throw new Error(`page meta row ${input.ownerId} not found`)
    }

    const latestRows = await tx
      .select()
      .from(contentTable)
      .where(and(eq(contentTable.type, 'page'), eq(contentTable.ownerId, input.ownerId)))
      .orderBy(desc(contentTable.revisionNo))
      .limit(1)
    const latest = latestRows[0]

    const nextToken = randomUUID()
    const now = new Date()

    let savedRow: ContentRow

    if (latest !== undefined && latest.status === 'draft') {
      if (
        !input.force &&
        input.expectedClientRevisionToken !== undefined &&
        input.expectedClientRevisionToken !== latest.clientRevisionToken
      ) {
        return { status: 'conflict' as const, latest, expectedToken: latest.clientRevisionToken }
      }
      const updated = await tx
        .update(contentTable)
        .set({
          updatedAt: now,
          body: input.body as ContentRow['body'],
          imageSources: input.imageSources as ContentRow['imageSources'],
          headings: input.headings as ContentRow['headings'],
          authorId: input.authorId ?? latest.authorId,
          clientRevisionToken: nextToken,
          status: 'published',
        })
        .where(eq(contentTable.id, latest.id))
        .returning()
      savedRow = updated[0]
    } else {
      if (
        !input.force &&
        input.expectedClientRevisionToken !== undefined &&
        latest !== undefined &&
        input.expectedClientRevisionToken !== latest.clientRevisionToken
      ) {
        return { status: 'conflict' as const, latest, expectedToken: latest.clientRevisionToken }
      }
      const nextRevisionNo = (latest?.revisionNo ?? 0) + 1
      const insert: NewContent = {
        type: 'page',
        ownerId: input.ownerId,
        revisionNo: nextRevisionNo,
        status: 'published',
        body: input.body as NewContent['body'],
        imageSources: input.imageSources as NewContent['imageSources'],
        headings: input.headings as NewContent['headings'],
        authorId: input.authorId,
        clientRevisionToken: nextToken,
      }
      const inserted = await tx.insert(contentTable).values(insert).returning()
      savedRow = inserted[0]
    }

    await tx
      .update(pageMetaTable)
      .set({ publishedRevisionId: savedRow.id, updatedAt: now })
      .where(eq(pageMetaTable.id, input.ownerId))

    return { status: 'published' as const, row: savedRow }
  })
}

// --- Misc -------------------------------------------------------------------

/** Maximum existing `revision_no` for `(type, ownerId)`. Used by tests. */
export async function maxRevisionNo(type: ContentType, ownerId: bigint): Promise<number | null> {
  const rows = await db
    .select({ value: max(contentTable.revisionNo) })
    .from(contentTable)
    .where(and(eq(contentTable.type, type), eq(contentTable.ownerId, ownerId)))
  return rows[0]?.value ?? null
}
