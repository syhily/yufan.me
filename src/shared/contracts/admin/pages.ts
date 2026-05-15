import { z } from 'zod'

import { listPagesSchema, savePageBodySchema, upsertPageMetaSchema } from '@/server/cms/pages/schema'
import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminPagesContract = c.router(
  {
    listPages: {
      method: 'GET',
      path: '/admin/list-pages',
      query: listPagesSchema,
      responses: { 200: z.any(), ...standardReadErrors },
      summary: 'listPages',
    },
    getPage: {
      method: 'GET',
      path: '/admin/get-page/:id',
      pathParams: idParam,
      responses: { 200: z.any(), ...standardReadErrors },
      summary: 'getPage',
    },
    deletePage: {
      method: 'DELETE',
      path: '/admin/delete-page/:id',
      pathParams: idParam,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'deletePage',
    },
    restorePage: {
      method: 'POST',
      path: '/admin/restore-page/:id',
      pathParams: idParam,
      body: c.noBody(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'restorePage',
    },
    unpublishPage: {
      method: 'POST',
      path: '/admin/unpublish-page',
      body: z.object({ id: z.string().min(1) }),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'unpublishPage',
    },
    saveDraft: {
      method: 'POST',
      path: '/admin/save-draft',
      body: savePageBodySchema,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'saveDraft',
    },
    publishLatest: {
      method: 'POST',
      path: '/admin/publish-latest',
      body: savePageBodySchema,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'publishLatest',
    },
    previewPage: {
      method: 'POST',
      path: '/admin/preview-page',
      body: z.object({ body: z.any() }),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'previewPage',
    },
    upsertPageMeta: {
      method: 'POST',
      path: '/admin/upsert-page-meta',
      body: upsertPageMetaSchema,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'upsertPageMeta',
    },
    listPageRevisions: {
      method: 'GET',
      path: '/admin/list-page-revisions',
      query: z.object({ id: z.string().min(1) }),
      responses: { 200: z.any(), ...standardReadErrors },
      summary: 'listPageRevisions',
    },
  },
  { strictStatusCodes: true },
)
