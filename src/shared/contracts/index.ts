// Shared Zod schemas used across multiple domains.
// Domain-specific DTOs live in sibling files under `src/shared/dtos/`.
import { z } from 'zod'

import type { AdminRevisionDto } from '@/shared/types/posts'

import { commentBodySchema } from '@/shared/pt/comment-schema'
import { portableTextBodySchema } from '@/shared/pt/schema'

// ─── primitive wire helpers ────────────────────────────
export const idString = z.string().regex(/^\d+$/, 'numeric id required')
export const isoDateTime = z.iso.datetime()

// ─── markdown / portable-text ──────────────────────────
export const markdownHeadingDto = z.object({
  depth: z.number().int().min(1).max(6),
  slug: z.string(),
  text: z.string(),
})

// ─── comments (shared by public + admin controllers) ───
export const commentBaseDto = z.object({
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

// ─── revision (shared by posts + pages controllers) ────
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

// ─── parity helpers (re-exported for sibling files) ────
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false
type Assert<T extends true> = T

// ─── parity assertion ──────────────────────────────────
type _adminRevisionDtoParity = Assert<Equals<z.infer<typeof adminRevisionDto>, AdminRevisionDto>>
