import { loadImageThumbhash } from '@/server/images/render-enhance'

export const imageController = {
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
