import { updateImageNoteSchema } from '@/server/images/schema'
import { updateImageNote } from '@/server/images/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'PATCH',
  input: updateImageNoteSchema,
  requireRole: 'author',
  async run({ payload, viewer }) {
    const image = await updateImageNote(BigInt(payload.id), payload.note ?? null, viewer)
    return { image }
  },
})
