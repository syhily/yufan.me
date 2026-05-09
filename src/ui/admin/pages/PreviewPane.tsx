import { useEffect, useRef, useState } from 'react'

import type { PortableTextBody } from '@/shared/portable-text'

import { submitApiAction } from '@/client/api/submit'
import { API_ACTIONS } from '@/shared/api-actions'

interface PreviewOutput {
  html: string
  headings: unknown[]
}

const PREVIEW = API_ACTIONS.admin.previewPage

export interface PreviewPaneProps {
  body: PortableTextBody
  /** Debounce window before re-rendering. Defaults to 500ms. */
  debounceMs?: number
}

// Right-pane live preview for the page editor. Owns its own debounce
// + AbortController + render loop so the editor doesn't re-render on
// every preview update. Server returns SSR'd HTML through
// `admin.previewPage`; we drop it into the document with
// `dangerouslySetInnerHTML` because the renderer is trusted (it's
// the same component that renders the public site).
export function PreviewPane({ body, debounceMs = 500 }: PreviewPaneProps) {
  const [html, setHtml] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isStale, setIsStale] = useState<boolean>(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setIsStale(true)
    const ctrl = new AbortController()
    // Cancel any in-flight render so we never render against an
    // older body snapshot.
    abortRef.current?.abort()
    abortRef.current = ctrl

    const run = async () => {
      try {
        const envelope = await submitApiAction<{ body: PortableTextBody }, PreviewOutput>(
          PREVIEW,
          { body },
          { signal: ctrl.signal },
        )
        if (ctrl.signal.aborted) {
          return
        }
        if ('data' in envelope && envelope.data !== undefined) {
          setHtml(envelope.data.html)
          setError(null)
          setIsStale(false)
        } else if ('error' in envelope && envelope.error !== undefined) {
          setError(envelope.error.message)
          setIsStale(false)
        }
      } catch (cause) {
        if (ctrl.signal.aborted) {
          return
        }
        setError(cause instanceof Error ? cause.message : '预览失败')
        setIsStale(false)
      }
    }
    const timer = window.setTimeout(() => {
      void run()
    }, debounceMs)

    return () => {
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [body, debounceMs])

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-md border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>实时预览</span>
        {isStale ? <span className="font-mono">渲染中…</span> : null}
        {error !== null ? <span className="text-destructive">{error}</span> : null}
      </div>
      <div
        className="post-content prose-blog prose prose-lg min-h-0 max-w-none grow overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
