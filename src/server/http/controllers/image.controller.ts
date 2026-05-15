import type { PublicContractImpl } from '@/server/http/ts-rest-adapter'

import { loadImageThumbhash } from '@/server/images/render-enhance'
import { imageContract } from '@/shared/contracts/image'

export const imageController: PublicContractImpl<typeof imageContract> = {
  resolveThumbhash: async ({ query }: { query: { src: string } }) => {
    const image = await loadImageThumbhash(query.src)
    return {
      status: 200 as const,
      body: {
        thumbhash: image?.thumbhash ?? null,
        width: image?.width ?? null,
        height: image?.height ?? null,
      },
    }
  },
}
