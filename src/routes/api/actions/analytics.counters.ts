import { parseAnalyticsSearch, queryCounters } from '@/server/analytics/query'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineGuardedApiAction({
  method: 'GET',
  requireRole: 'admin',
  async run({ ctx }) {
    const input = parseAnalyticsSearch(ctx.url.searchParams)
    return await queryCounters(input)
  },
})
