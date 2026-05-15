import { ApiError } from '@/client/api/error'

/**
 * Extract all 2xx-shaped members from a ts-rest response union.
 * Uses template-literal pattern matching so any status code in
 * the 200-299 range is accepted without maintaining a hard-coded
 * list (e.g. 200 | 201 | 204).
 */
type SuccessResponse<T> = T extends { status: infer S }
  ? S extends number
    ? `${S}` extends `2${string}`
      ? T
      : never
    : never
  : never

/**
 * Unwrap a ts-rest client promise, throwing `ApiError` on non-2xx
 * responses so callers can use standard `try / catch`.
 */
export async function unwrap<T extends { status: number; body: unknown }>(
  promise: Promise<T>,
): Promise<SuccessResponse<T>['body']> {
  const res = await promise
  if (res.status >= 200 && res.status < 300) {
    return res.body as SuccessResponse<T>['body']
  }
  const body =
    typeof res.body === 'object' && res.body !== null
      ? (res.body as {
          error?: { message?: string; issues?: { message: string; path?: string[] }[] }
        })
      : undefined
  throw new ApiError(body?.error?.message ?? `HTTP ${res.status}`, res.status, body?.error?.issues)
}
