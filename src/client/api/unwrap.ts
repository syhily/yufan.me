import { ApiError } from './error'

export async function unwrap<T extends { status: number; body: unknown }>(
  promise: Promise<T>,
): Promise<Extract<T, { status: 200 | 201 | 204 }>['body']> {
  const res = await promise
  if (res.status >= 200 && res.status < 300) {
    return (res as any).body
  }
  const body = res.body as { error?: { message?: string; issues?: unknown } } | undefined
  throw new ApiError(body?.error?.message ?? `HTTP ${res.status}`, res.status, body?.error?.issues)
}
