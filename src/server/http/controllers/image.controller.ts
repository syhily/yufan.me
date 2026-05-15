import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { imageContract } from '@/shared/contracts/image'

import { loadImageThumbhash } from '@/server/images/render-enhance'

export const imageController: ContractImpl<typeof imageContract> = {
  resolveThumbhash: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const query = args.query as { src: string }
    const image = await loadImageThumbhash(query.src)
    return {
      status: 200,
      body: {
        thumbhash: image?.thumbhash ?? null,
        width: image?.width ?? null,
        height: image?.height ?? null,
      },
    }
  },
}
