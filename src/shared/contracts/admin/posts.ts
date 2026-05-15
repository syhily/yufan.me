import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminPostsContract = c.router(
  {
    listPosts: {
      method: 'GET',
      path: '/admin/list-posts',
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'listPosts',
    },
    getPost: {
      method: 'GET',
      path: '/admin/get-post/:id',
      pathParams: idParam,
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'getPost',
    },
    deletePost: {
      method: 'DELETE',
      path: '/admin/delete-post/:id',
      pathParams: idParam,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'deletePost',
    },
    restorePost: {
      method: 'POST',
      path: '/admin/restore-post/:id',
      pathParams: idParam,
      body: z.any() /* TODO: use restorePostSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'restorePost',
    },
    unpublishPost: {
      method: 'POST',
      path: '/admin/unpublish-post',
      body: z.any() /* TODO: use unpublishPostSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'unpublishPost',
    },
    savePostDraft: {
      method: 'POST',
      path: '/admin/save-post-draft',
      body: z.any() /* TODO: use savePostBodySchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'savePostDraft',
    },
    publishPostLatest: {
      method: 'POST',
      path: '/admin/publish-post-latest',
      body: z.any() /* TODO: use savePostBodySchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'publishPostLatest',
    },
    previewPost: {
      method: 'POST',
      path: '/admin/preview-post',
      body: z.any() /* TODO: use previewPostBodySchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'previewPost',
    },
    upsertPostMeta: {
      method: 'POST',
      path: '/admin/upsert-post-meta',
      body: z.any() /* TODO: use upsertPostMetaSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'upsertPostMeta',
    },
    listPostRevisions: {
      method: 'GET',
      path: '/admin/list-post-revisions',
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'listPostRevisions',
    },
  },
  { strictStatusCodes: true },
)
