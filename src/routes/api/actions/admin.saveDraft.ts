import { savePageBodySchema } from '@/server/cms/pages/schema'
import { saveDraft } from '@/server/cms/pages/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

// Save the current editor body as a draft.
//
// Two-state outcome (echoed verbatim by the wire envelope):
//   - status: 'saved' — server wrote the row; client adopts the
//     returned token + revision metadata.
//   - status: 'conflict' — server's latest token diverged; client
//     must rebase / overwrite (force=true) before retrying.
// 1MB ceiling. See `admin.previewPage` for the rationale.
const MAX_BODY_BYTES = 1 * 1024 * 1024

export const action = defineApiAction({
  method: 'POST',
  input: savePageBodySchema,
  requireRole: 'admin',
  maxBodyBytes: MAX_BODY_BYTES,
  async run({ payload, viewer }) {
    return saveDraft({
      pageId: BigInt(payload.id),
      body: payload.body,
      expectedClientRevisionToken: payload.expectedClientRevisionToken ?? undefined,
      force: payload.force,
      authorId: BigInt(viewer.userId),
    })
  },
})
