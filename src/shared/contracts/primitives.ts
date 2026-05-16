import { z } from 'zod'

// ─── primitive wire helpers ────────────────────────────
export const idString = z.string().regex(/^\d+$/, 'numeric id required')
export const isoDateTime = z.iso.datetime()

// ─── markdown / portable-text ──────────────────────────
export const markdownHeadingDto = z.object({
  depth: z.number().int().min(1).max(6),
  slug: z.string(),
  text: z.string(),
})
