import { userSession } from '@/server/auth/primitives'
import { ContentCatalog } from '@/server/catalog'
import { savePageBodySchema } from '@/server/cms/pages/schema'
import { publishLatest } from '@/server/cms/pages/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

// Publish atomically: save the editor body as a draft, mark that
// revision as published, and point `doc.published_revision_id` at it
// — all in one transaction. Same conflict semantics as `saveDraft`
// (token mismatch returns `conflict` unless `force=true`).
//
// On success the in-process catalog snapshot is reset so the next
// public render reflects the new body.
// 1MB ceiling. See `admin.previewPage` for the rationale.
const MAX_BODY_BYTES = 1 * 1024 * 1024

export const action = defineApiAction({
  method: 'POST',
  input: savePageBodySchema,
  requireAdmin: true,
  maxBodyBytes: MAX_BODY_BYTES,
  async run({ ctx, payload }) {
    const user = userSession(ctx.session)
    const authorId = user?.id ? BigInt(user.id) : null
    const result = await publishLatest({
      pageId: BigInt(payload.id),
      body: payload.body,
      expectedClientRevisionToken: payload.expectedClientRevisionToken ?? undefined,
      force: payload.force,
      authorId,
      // Future publishedAt = scheduled publish; absent / past = "now".
      // The schema validates ISO-8601, the repo defaults to `now()`
      // when omitted.
      publishedAt: payload.publishedAt !== undefined ? new Date(payload.publishedAt) : undefined,
    })
    if (result.status === 'saved') {
      ContentCatalog.reset()
    }
    return result
  },
})
