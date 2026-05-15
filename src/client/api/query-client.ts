import { QueryClient } from '@tanstack/react-query'

/**
 * Default QueryClient for the ts-rest + TanStack Query layer.
 *
 * Created once per browser session. SSR dehydration is not implemented
 * yet — the root loader still returns the initial data directly and
 * client-side queries start from `undefined` (or seed with loader data
 * at the consumer level).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})
