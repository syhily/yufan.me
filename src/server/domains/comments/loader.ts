export type { MetricTarget } from '@/server/domains/comments/service'
export {
  createComment,
  ensureCommentPage,
  latestComments,
  loadComments,
  parseComments,
  pendingComments,
  resolveMetricTarget,
  safeResolveMetricTarget,
} from '@/server/domains/comments/service'
