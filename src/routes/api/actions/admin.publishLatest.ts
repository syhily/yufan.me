import { savePageBodySchema } from '@/server/cms/pages/schema'
import { publishLatest } from '@/server/cms/pages/service'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

// Publish atomically: save the editor body as a draft, mark that
// revision as published, and point `page.published_revision_id` at
// it — all in one transaction. Same conflict semantics as
// `saveDraft` (token mismatch returns `conflict` unless `force=true`).
//
// On success the in-process catalog snapshot is reset so the next
// public render reflects the new body.
// 1MB ceiling. See `admin.previewPage` for the rationale.
const MAX_BODY_BYTES = 1 * 1024 * 1024

export const action = defineGuardedApiAction({
  method: 'POST',
  input: savePageBodySchema,
  requireRole: 'admin',
  maxBodyBytes: MAX_BODY_BYTES,
  async run({ payload, viewer }) {
    return publishLatest({
      pageId: BigInt(payload.id),
      body: payload.body,
      expectedClientRevisionToken: payload.expectedClientRevisionToken ?? undefined,
      force: payload.force,
      authorId: BigInt(viewer.userId),
      // Future publishedAt = scheduled publish; absent / past = "now".
      // The schema validates ISO-8601, the repo defaults to `now()`
      // when omitted.
      publishedAt: payload.publishedAt !== undefined ? new Date(payload.publishedAt) : undefined,
    })
  },
})
