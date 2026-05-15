import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { imageContract } from '@/shared/contracts/image'

import { ok } from '@/server/http/response'
import { query } from '@/server/http/ts-rest-adapter'
import { loadImageThumbhash } from '@/server/images/render-enhance'

interface ResolveThumbhashQuery {
  src: string
}

export const imageController: ContractImpl<typeof imageContract> = {
  resolveThumbhash: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<ResolveThumbhashQuery>(args)
    const image = await loadImageThumbhash(q.src)
    return ok({
      thumbhash: image?.thumbhash ?? null,
      width: image?.width ?? null,
      height: image?.height ?? null,
    })
  },
}
