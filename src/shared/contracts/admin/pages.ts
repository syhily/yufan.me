import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminPagesContract = c.router(
  {
    listPages: {
      method: 'GET',
      path: '/admin/list-pages',
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'listPages',
    },
    getPage: {
      method: 'GET',
      path: '/admin/get-page/:id',
      pathParams: idParam,
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
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
      body: z.any() /* TODO: use restorePageSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'restorePage',
    },
    unpublishPage: {
      method: 'POST',
      path: '/admin/unpublish-page',
      body: z.any() /* TODO: use unpublishPageSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'unpublishPage',
    },
    saveDraft: {
      method: 'POST',
      path: '/admin/save-draft',
      body: z.any() /* TODO: use savePageBodySchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'saveDraft',
    },
    publishLatest: {
      method: 'POST',
      path: '/admin/publish-latest',
      body: z.any() /* TODO: use savePageBodySchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'publishLatest',
    },
    previewPage: {
      method: 'POST',
      path: '/admin/preview-page',
      body: z.any() /* TODO: use previewPageBodySchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'previewPage',
    },
    upsertPageMeta: {
      method: 'POST',
      path: '/admin/upsert-page-meta',
      body: z.any() /* TODO: use upsertPageMetaSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'upsertPageMeta',
    },
    listPageRevisions: {
      method: 'GET',
      path: '/admin/list-page-revisions',
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'listPageRevisions',
    },
  },
  { strictStatusCodes: true },
)
