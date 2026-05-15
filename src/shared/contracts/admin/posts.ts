import { z } from 'zod'

import type { AdminPostDetailDto, AdminPostDto, AdminRevisionDto, ListPostsOutput } from '@/shared/cms-posts'

import {
  listPostsSchema,
  previewPostBodySchema,
  savePostBodySchema,
  upsertPostMetaSchema,
} from '@/server/cms/posts/schema'
import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminPostsContract = c.router(
  {
    listPosts: {
      method: 'GET',
      path: '/admin/posts',
      query: listPostsSchema,
      responses: { 200: z.custom<ListPostsOutput>(), ...standardReadErrors },
      summary: 'listPosts',
    },
    getPost: {
      method: 'GET',
      path: '/admin/posts/:id',
      pathParams: idParam,
      responses: { 200: z.custom<AdminPostDetailDto>(), ...standardReadErrors },
      summary: 'getPost',
    },
    deletePost: {
      method: 'DELETE',
      path: '/admin/posts/:id',
      pathParams: idParam,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'deletePost',
    },
    restorePost: {
      method: 'POST',
      path: '/admin/posts/:id/restore',
      pathParams: idParam,
      body: c.noBody(),
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'restorePost',
    },
    unpublishPost: {
      method: 'POST',
      path: '/admin/posts/unpublish',
      body: z.object({ id: z.string().min(1) }),
      responses: { 200: z.object({ post: z.custom<AdminPostDto>() }), ...standardMutationErrors },
      summary: 'unpublishPost',
    },
    savePostDraft: {
      method: 'POST',
      path: '/admin/posts/draft',
      body: savePostBodySchema,
      responses: {
        200: z.discriminatedUnion('status', [
          z.object({ status: z.literal('saved'), revision: z.custom<AdminRevisionDto>() }),
          z.object({ status: z.literal('conflict'), latest: z.custom<AdminRevisionDto>(), expectedToken: z.string() }),
        ]),
        ...standardMutationErrors,
      },
      summary: 'savePostDraft',
    },
    publishPostLatest: {
      method: 'POST',
      path: '/admin/posts/publish',
      body: savePostBodySchema,
      responses: {
        200: z.discriminatedUnion('status', [
          z.object({ status: z.literal('saved'), revision: z.custom<AdminRevisionDto>() }),
          z.object({ status: z.literal('conflict'), latest: z.custom<AdminRevisionDto>(), expectedToken: z.string() }),
        ]),
        ...standardMutationErrors,
      },
      summary: 'publishPostLatest',
    },
    previewPost: {
      method: 'POST',
      path: '/admin/posts/preview',
      body: previewPostBodySchema,
      responses: {
        200: z.object({
          html: z.string(),
          headings: z.array(z.object({ text: z.string(), depth: z.number(), slug: z.string() })),
        }),
        ...standardMutationErrors,
      },
      summary: 'previewPost',
    },
    upsertPostMeta: {
      method: 'POST',
      path: '/admin/posts/meta',
      body: upsertPostMetaSchema,
      responses: { 200: z.object({ post: z.custom<AdminPostDto>() }), ...standardMutationErrors },
      summary: 'upsertPostMeta',
    },
    listPostRevisions: {
      method: 'GET',
      path: '/admin/posts/revisions',
      query: z.object({ id: z.string().min(1) }),
      responses: { 200: z.object({ revisions: z.array(z.custom<AdminRevisionDto>()) }), ...standardReadErrors },
      summary: 'listPostRevisions',
    },
  },
  { strictStatusCodes: true },
)
