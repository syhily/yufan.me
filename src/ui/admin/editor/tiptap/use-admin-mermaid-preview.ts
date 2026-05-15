import { useEffect, useRef, useState } from 'react'

import type { RenderMermaidInput } from '@/shared/cms-pages'

import { api } from '@/client/api/client'
import { useApiMutation } from '@/client/api/query'
import { unwrap } from '@/client/api/unwrap'

const DEBOUNCE_MS = 200

/** Debounced `admin.renderMermaid` preview — same `beautiful-mermaid` path as prerender on save. */
export function useAdminMermaidPreview(code: string): {
  previewHtml: string
  renderError: string | null
  showSpinner: boolean
} {
  const lastValidSvg = useRef('')
  const [previewSvg, setPreviewSvg] = useState('')
  const [renderError, setRenderError] = useState<string | null>(null)

  const renderMermaid = useApiMutation(
    (input: RenderMermaidInput) => unwrap(api.admin.editor.renderMermaid({ body: input })),
    {
      onSuccess: (result) => {
        if (result.error !== null) {
          setRenderError(result.error)
          return
        }
        setRenderError(null)
        lastValidSvg.current = result.svg
        setPreviewSvg(result.svg)
      },
      onError: () => {
        setRenderError('渲染服务暂不可用')
      },
    },
  )

  useEffect(() => {
    if (code.trim() === '') {
      lastValidSvg.current = ''
      setPreviewSvg('')
      setRenderError(null)
      return
    }
    const timer = setTimeout(() => {
      renderMermaid.mutate({ code })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
    // oxlint-disable-next-line exhaustive-deps
  }, [code, renderMermaid.mutate])

  const showSpinner = previewSvg === '' && renderMermaid.isPending
  const previewHtml = previewSvg !== '' ? previewSvg : lastValidSvg.current

  return { previewHtml, renderError, showSpinner }
}
