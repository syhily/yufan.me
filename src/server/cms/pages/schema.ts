import { z } from 'zod'

import type {
  DeletePageInput,
  GetPageInput,
  ListPageRevisionsInput,
  ListPagesInput,
  PreviewPageBodyInput,
  RestorePageInput,
  SavePageBodyInput,
  UpsertPageMetaInput,
} from '@/shared/cms-pages'

import { portableTextBodySchema } from '@/shared/portable-text'

// Re-export the wire-format types alongside the Zod validators so
// admin Resource Routes import schema + type from the same module.
export type {
  DeletePageInput,
  GetPageInput,
  ListPageRevisionsInput,
  ListPagesInput,
  PreviewPageBodyInput,
  RestorePageInput,
  SavePageBodyInput,
  UpsertPageMetaInput,
}

// `slug()` enforces the same kebab-case-ASCII shape `service.ts` checks
// at the business-logic layer. Validation happens here too so the API
// envelope speaks Zod's vocabulary on a malformed input — the service
// layer's own check is a defence-in-depth fallback (callers can save
// and bypass HTTP).
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, 'Invalid slug')

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value ?? '')

const idSchema = z.object({
  id: z.string().min(1),
})

// Search params come in as strings, so we coerce numeric fields and
// booleans before handing them to the service layer.
export const listPagesSchema = z.object({
  q: z.string().trim().max(100).optional(),
  includeDeleted: z.coerce.boolean().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const getPageSchema = idSchema
export const deletePageSchema = idSchema
export const restorePageSchema = idSchema
export const listPageRevisionsSchema = idSchema

// Optional fields are normalised to safe defaults at the schema level
// so the service layer's UpsertPageMetaInput always sees fully-shaped
// values. `cover` is allowed to be empty (admin can publish a page
// without a cover image — covers are optional in `ClientPage`).
export const upsertPageMetaSchema = z.object({
  id: z.string().min(1).optional(),
  slug: slugSchema,
  title: z.string().trim().min(1).max(200),
  summary: optionalText(500),
  cover: z.string().trim().max(500).optional().default(''),
  // `og` is nullable on the wire (admin can clear a previously-set
  // value). Trim + empty-string collapses to null so DB keeps a
  // single canonical "absent" representation.
  og: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  published: z.coerce.boolean().optional(),
  commentsEnabled: z.coerce.boolean().optional(),
  showToc: z.coerce.boolean().optional(),
  publishedAt: z.iso.datetime({ offset: true }).optional(),
})

// Save / publish share the same input shape — the difference lives in
// which resource route the editor POSTs to. We pull `body` through
// `portableTextBodySchema` here so a malformed save fails at the
// API perimeter (400) rather than reaching the transactional service
// layer (which then has to translate the same Zod issues anyway).
export const savePageBodySchema = z.object({
  id: z.string().min(1),
  body: portableTextBodySchema,
  expectedClientRevisionToken: z.uuid().nullable().optional(),
  force: z.coerce.boolean().optional(),
})

// `previewPage` is a read-only render path, but it still needs the
// body validator because the editor sends the whole document.
export const previewPageBodySchema = z.object({
  body: portableTextBodySchema,
})
