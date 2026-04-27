import { useCallback, useEffect, useRef, useState } from 'react'

import type { ApiActionDescriptor } from '@/client/api/fetcher'

import { dispatchApiError } from '@/client/api/error-bus'

// Streaming NDJSON parser for resource routes that emit one JSON object
// per line. Used by endpoints whose JSON-envelope shape would force the
// client to wait for the slowest payload (e.g. `comment.loadComments`
// where each comment's MDX compilation is independent and the user gets
// to see roots as they're ready).
//
// The hook handshakes via `Accept: application/x-ndjson` so the same URL
// can still serve the legacy `{ comments, next }` envelope to non-stream
// clients (curl, RSS-style probes). The stream payload terminates with a
// final `{ type: 'end' }` line, or `{ type: 'error', message }` if the
// generator threw mid-stream.

export interface UseApiStreamOptions<Line> {
  /** Fired once per parsed NDJSON line in source order. */
  onLine?: (line: Line) => void
  /** Fired once when the stream closes cleanly (after all `onLine` calls). */
  onDone?: () => void
  /**
   * Fired for transport-level failures (network error, HTTP 4xx/5xx, JSON
   * parse error, or a server-emitted `{ type: 'error', message }` line).
   * The hook stops parsing further lines after this fires.
   */
  onError?: (error: { message: string }) => void
}

export interface UseApiStreamResult<I> {
  /**
   * Kick off a streaming GET request. Existing in-flight streams are
   * aborted before the new one starts, mirroring the
   * `react-router useFetcher` "latest wins" semantics.
   */
  load: (query?: I) => void
  /** True while a stream is open. */
  isPending: boolean
}

interface ErrorLine {
  type: 'error'
  message: string
}

function isErrorLine(line: unknown): line is ErrorLine {
  return typeof line === 'object' && line !== null && (line as { type?: unknown }).type === 'error' && 'message' in line
}

// Each `Record<string, ...>` is a *constraint* (not a mapped shape) so
// passing a concrete `LoadCommentsInput`-style interface satisfies it
// only when every property is string/number-compatible. Use a
// `Record`-typed key constraint to model that without forcing every
// caller to widen their input shape into a string-indexed map.
type StreamQuery = Record<string, string | number | boolean>

// `useApiStream` is the streaming counterpart to `useApiAction` from
// `@/client/api/fetcher`. It uses native `fetch` + a `ReadableStream`
// reader instead of `useFetcher`, because React Router's fetcher waits
// for the response to drain before exposing it as a single `data`. For
// truly incremental UIs (load-more comments, live progress, etc.) we
// need the per-line callback path.
export function useApiStream<I, Line>(
  action: ApiActionDescriptor,
  options?: UseApiStreamOptions<Line>,
): UseApiStreamResult<I> {
  const [isPending, setPending] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options
  const actionRef = useRef(action)
  actionRef.current = action

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const load = useCallback(
    (query?: I) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const url = buildStreamUrl(action.path, query as StreamQuery | undefined)
      setPending(true)
      void runStream<Line>(url, controller.signal, optionsRef, actionRef).finally(() => {
        if (abortRef.current === controller) {
          abortRef.current = null
          setPending(false)
        }
      })
    },
    [action.path],
  )

  return { load, isPending }
}

function buildStreamUrl(path: string, query: StreamQuery | undefined): string {
  if (!query) {
    return path
  }
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    search.set(k, String(v))
  }
  return `${path}?${search.toString()}`
}

async function runStream<Line>(
  url: string,
  signal: AbortSignal,
  optionsRef: { current: UseApiStreamOptions<Line> | undefined },
  actionRef: { current: ApiActionDescriptor },
): Promise<void> {
  // Site-specific `onError` always wins; otherwise dispatch to the global
  // toast bus so users see *something* even when the call site forgets to
  // hook up its own error handler. SSR has no listener attached so the
  // bus falls back to console.error.
  const reportError = (message: string): void => {
    if (optionsRef.current?.onError) {
      optionsRef.current.onError({ message })
      return
    }
    const action = actionRef.current
    dispatchApiError({ message, method: action.method, path: action.path })
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/x-ndjson' },
      signal,
    })
  } catch (error) {
    if (signal.aborted) {
      return
    }
    reportError(error instanceof Error ? error.message : '请求失败')
    return
  }

  if (!response.ok || !response.body) {
    reportError(`请求失败：HTTP ${response.status}`)
    return
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let errored = false

  const flushLine = (raw: string): void => {
    if (errored) {
      return
    }
    const trimmed = raw.trim()
    if (trimmed === '') {
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      errored = true
      reportError('响应解析失败')
      return
    }
    if (isErrorLine(parsed)) {
      errored = true
      reportError(parsed.message)
      return
    }
    optionsRef.current?.onLine?.(parsed as Line)
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      buffer += value
      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(newlineIndex + 1)
        flushLine(line)
        newlineIndex = buffer.indexOf('\n')
      }
    }
    if (buffer.length > 0) {
      flushLine(buffer)
    }
    if (!errored) {
      optionsRef.current?.onDone?.()
    }
  } catch (error) {
    if (signal.aborted) {
      return
    }
    reportError(error instanceof Error ? error.message : '响应读取失败')
  }
}
