import { buildFeedRoute } from '@/web/feed/route'

export const { GET, HEAD } = buildFeedRoute({ format: 'atom' })
