import type { ApiActionDescriptor } from '@/client/api/fetcher'

export interface SubmitApiActionOptions {
  /**
   * Optional AbortSignal so callers can cancel an in-flight request.
   */
  signal?: AbortSignal
}

function extractPathParams(
  path: string,
  payload: Record<string, unknown>,
): { path: string; remainder: Record<string, unknown> } {
  let resultPath = path
  const remainder: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    const placeholder = `:${key}`
    if (resultPath.includes(placeholder)) {
      resultPath = resultPath.replace(placeholder, encodeURIComponent(String(value)))
    } else {
      remainder[key] = value
    }
  }
  return { path: resultPath, remainder }
}

function isLegacyEnvelope<T>(value: unknown): value is { data?: T; error?: { message: string } } {
  return value !== null && typeof value === 'object' && ('data' in value || 'error' in value)
}

function normaliseResponse<T>(value: unknown): { data?: T; error?: { message: string } } {
  if (isLegacyEnvelope<T>(value)) {
    return { data: value.data, error: value.error }
  }
  return { data: value as T }
}

/**
 * Promise-returning counterpart to `useApiFetcher`. Bypasses the React Router
 * fetcher infrastructure and hits the Hono API directly via `fetch`.
 *
 * Supports both legacy envelope responses (`{ data, error }`) and direct
 * ts-rest/Hono body responses. Path parameters (`:id`, `:rid`) are
 * automatically extracted from the payload and substituted into the URL.
 */
export async function submitApiAction<I, O>(
  action: ApiActionDescriptor,
  payload: I,
  options: SubmitApiActionOptions = {},
): Promise<{ data?: O; error?: { message: string } }> {
  try {
    const { path, remainder } = extractPathParams(action.path, (payload ?? {}) as Record<string, unknown>)
    const body = Object.keys(remainder).length > 0 ? JSON.stringify(remainder) : undefined

    const response = await fetch(path, {
      method: action.method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body,
      signal: options.signal,
    })

    const text = await response.text()
    if (text === '') {
      if (response.ok) {
        return { data: undefined as unknown as O }
      }
      return { error: { message: response.statusText || 'request_failed' } }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { error: { message: text.slice(0, 256) } }
    }

    const { data, error } = normaliseResponse<O>(parsed)
    if (error) {
      return { error }
    }
    return { data }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return { error: { message } }
  }
}
