import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

/**
 * Browser singleton for SPA navigations after initial hydration.
 * On the server a fresh instance should be created per request.
 */
export const browserQueryClient = makeQueryClient()
