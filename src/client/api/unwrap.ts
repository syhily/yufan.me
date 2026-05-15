import { ORPCError, fallbackORPCErrorStatus } from '@orpc/client'

import { ApiError } from '@/client/api/error'

/**
 * Unwrap an oRPC client promise.
 *
 * The ts-rest era wrapped responses in `{ status, body }` and this
 * helper extracted the body / threw `ApiError` on non-2xx. oRPC's
 * happy path returns the procedure's `output` directly and rejects
 * with `ORPCError` on failure — so the only job left is bridging
 * `ORPCError → ApiError` so existing UI consumers (toast handlers,
 * error boundaries) keep working unchanged.
 *
 * Strictly speaking callers can `await orpc.x.y(input)` directly
 * and skip this; we keep `unwrap` as a no-op-on-success layer so
 * existing call sites don't need to be rewritten beyond the
 * `api → orpc` rename that the codemod handles.
 */
export async function unwrap<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise
  } catch (err) {
    if (err instanceof ORPCError) {
      const status = fallbackORPCErrorStatus(err.code, err.status)
      const issues = Array.isArray((err.data as { issues?: unknown })?.issues)
        ? (err.data as { issues: { message: string; path?: string[] }[] }).issues
        : undefined
      throw new ApiError(err.message, status, issues)
    }
    throw err
  }
}
