import { z } from 'zod'

import type { AdminPageDetailDto, AdminPageDto, AdminRevisionDto, ListPagesOutput } from '@/shared/cms-pages'

import { listPagesSchema, savePageBodySchema, upsertPageMetaSchema } from '@/server/cms/pages/schema'
import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'
import { portableTextBodySchema } from '@/shared/pt/schema'

const idParam = z.object({ id: z.string().min(1) })

export const adminPagesContract = c.router(
  {
    listPages: {
      method: 'GET',
      path: '/admin/pages',
      query: listPagesSchema,
      responses: { 200: z.custom<ListPagesOutput>(), ...standardReadErrors },
      summary: 'listPages',
    },
    getPage: {
      method: 'GET',
      path: '/admin/pages/:id',
      pathParams: idParam,
      responses: { 200: z.custom<AdminPageDetailDto>(), ...standardReadErrors },
      summary: 'getPage',
    },
    deletePage: {
      method: 'DELETE',
      path: '/admin/pages/:id',
      pathParams: idParam,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'deletePage',
    },
    restorePage: {
      method: 'POST',
      path: '/admin/pages/:id/restore',
      pathParams: idParam,
      body: c.noBody(),
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'restorePage',
    },
    unpublishPage: {
      method: 'POST',
      path: '/admin/pages/unpublish',
      body: z.object({ id: z.string().min(1) }),
      responses: { 200: z.object({ page: z.custom<AdminPageDto>() }), ...standardMutationErrors },
      summary: 'unpublishPage',
    },
    savePageDraft: {
      method: 'POST',
      path: '/admin/pages/draft',
      body: savePageBodySchema,
      responses: {
        200: z.discriminatedUnion('status', [
          z.object({ status: z.literal('saved'), revision: z.custom<AdminRevisionDto>() }),
          z.object({ status: z.literal('conflict'), latest: z.custom<AdminRevisionDto>(), expectedToken: z.string() }),
        ]),
        ...standardMutationErrors,
      },
      summary: 'savePageDraft',
    },
    publishPageLatest: {
      method: 'POST',
      path: '/admin/pages/publish',
      body: savePageBodySchema,
      responses: {
        200: z.discriminatedUnion('status', [
          z.object({ status: z.literal('saved'), revision: z.custom<AdminRevisionDto>() }),
          z.object({ status: z.literal('conflict'), latest: z.custom<AdminRevisionDto>(), expectedToken: z.string() }),
        ]),
        ...standardMutationErrors,
      },
      summary: 'publishPageLatest',
    },
    previewPage: {
      method: 'POST',
      path: '/admin/pages/preview',
      body: z.object({ body: portableTextBodySchema }),
      responses: {
        200: z.object({
          html: z.string(),
          headings: z.array(z.object({ text: z.string(), depth: z.number(), slug: z.string() })),
        }),
        ...standardMutationErrors,
      },
      summary: 'previewPage',
    },
    upsertPageMeta: {
      method: 'POST',
      path: '/admin/pages/meta',
      body: upsertPageMetaSchema,
      responses: { 200: z.object({ page: z.custom<AdminPageDto>() }), ...standardMutationErrors },
      summary: 'upsertPageMeta',
    },
    listPageRevisions: {
      method: 'GET',
      path: '/admin/pages/revisions',
      query: z.object({ id: z.string().min(1) }),
      responses: { 200: z.object({ revisions: z.array(z.custom<AdminRevisionDto>()) }), ...standardReadErrors },
      summary: 'listPageRevisions',
    },
  },
  { strictStatusCodes: true },
)
