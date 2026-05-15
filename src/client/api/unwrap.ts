// Success-branch unwrap for ts-rest client calls.
//
// `api.<domain>.<endpoint>(...)` returns a discriminated union
// `{ status, body }`. Most call sites care only about the 2xx body
// and want a thrown error otherwise — that's what `unwrap` provides.
// Mirrors plan Part 7.2.

import { ApiError } from '@/client/api/error'

type AnyResult = { status: number; body: unknown }

type SuccessOf<T extends AnyResult> = Extract<T, { status: 200 | 201 | 204 }>

export async function unwrap<T extends AnyResult>(promise: Promise<T>): Promise<SuccessOf<T>['body']> {
  const res = await promise
  if (res.status >= 200 && res.status < 300) {
    return res.body as SuccessOf<T>['body']
  }
  const body = res.body as { error?: { message?: string; issues?: { message: string; path?: string[] }[] } } | undefined
  throw new ApiError(body?.error?.message ?? `HTTP ${res.status}`, res.status, body?.error?.issues)
}
