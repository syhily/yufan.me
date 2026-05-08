import { createORPCReactQueryUtils } from '@orpc/react-query'

import { orpc } from './client'

/**
 * Typed oRPC + TanStack Query integration.
 *
 * Every procedure under `apiRouter` exposes:
 *   - `orpcQuery.xxx.yyy.queryOptions({ input })`  → useQuery / useSuspenseQuery
 *   - `orpcQuery.xxx.yyy.mutationOptions()`        → useMutation
 *   - `orpcQuery.xxx.yyy.key({ input })`           → QueryKey for prefetch / invalidate
 *   - `orpcQuery.xxx.yyy.matcher()`                → invalidation scope
 *
 * Example:
 *   const { data } = useQuery(orpcQuery.admin.posts.list.queryOptions({ input: { offset: 0 } }))
 *   const mutation = useMutation(orpcQuery.admin.posts.delete.mutationOptions())
 */
export const orpcQuery = createORPCReactQueryUtils(orpc)
