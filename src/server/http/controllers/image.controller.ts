import { z } from 'zod'

import { publicProc } from '@/server/http/orpc-base'
import { loadImageThumbhash } from '@/server/images/render-enhance'

const resolveThumbhash = publicProc
  .input(z.object({ src: z.string().trim().min(1).max(2000) }))
  .output(
    z.object({
      thumbhash: z.string().nullable(),
      width: z.coerce.number().nullable(),
      height: z.coerce.number().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const image = await loadImageThumbhash(input.src)
    return {
      thumbhash: image?.thumbhash ?? null,
      width: image?.width ?? null,
      height: image?.height ?? null,
    }
  })

export const imageRouter = { resolveThumbhash }
